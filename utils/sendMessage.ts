import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebaseClient";
import { Message, ChatData, UserData } from "@/types";
import {
  checkAndIncrementUsage,
  checkFileStorageLimit,
  incrementFileStorage,
} from "@/lib/usageTracking";
import axios from 'axios';

export const sendMessage = async (
  content: string,
  file: File | undefined,
  audioBlob: Blob | undefined,
  chatId: string,
  userId: string,
  chatData: ChatData,
  participantLanguages: string[]
) => {
  if ((!content.trim() && !file && !audioBlob) || !userId) return;

  try {
    // Check message count limit
    const canSendMessage = await checkAndIncrementUsage(userId, "messages");
    if (!canSendMessage) {
      throw new Error("You've reached your message limit for the free tier. Please upgrade to send more messages.");
    }

    let messageData: Partial<Message> = {
      senderId: userId,
      timestamp: serverTimestamp(),
      chatId: chatId,
    };

    if (audioBlob) {
      // Handle voice note
      const fileName = `voice_${Date.now()}.webm`;
      const storageRef = ref(storage, `chats/${chatId}/${fileName}`);
      await uploadBytes(storageRef, audioBlob);
      const downloadURL = await getDownloadURL(storageRef);

      messageData = {
        ...messageData,
        type: "audio",
        content: fileName,
        fileUrl: downloadURL,
      };

      // Increment file storage usage
      await incrementFileStorage(userId, audioBlob.size);

      // Transcribe the audio
      try {
        const transcriptionResponse = await axios.post('/api/service?endpoint=stt', audioBlob, {
          headers: {
            'Content-Type': 'audio/webm',
          },
        });
        messageData.originalContent = transcriptionResponse.data.text;
      } catch (error) {
        console.error("Error transcribing audio:", error);
        messageData.originalContent = "Transcription failed";
      }
    } else if (file) {
      // Handle file upload (image or other file)
      const canUploadFile = await checkFileStorageLimit(userId, file.size);
      if (!canUploadFile) {
        throw new Error("You've reached your file storage limit for the free tier. Please upgrade to upload more files.");
      }
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File size exceeds the maximum limit of 10MB.");
      }

      const storageRef = ref(storage, `chats/${chatId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      messageData = {
        ...messageData,
        type: file.type.startsWith("image/") ? "image" : "file",
        content: file.name,
        fileUrl: downloadURL,
      };

      // Increment file storage usage
      await incrementFileStorage(userId, file.size);
    } else {
      // Handle text message
      messageData = {
        ...messageData,
        type: "text",
        content: content,
      };
    }

    // Handle translation for text messages and transcribed audio
    if (messageData.type === "text" || messageData.type === "audio") {
      const textToTranslate = messageData.type === "audio" ? messageData.originalContent! : content;

      if (chatData?.type === "private") {
        const otherParticipantId = chatData.participants.find(
          (p) => p !== userId
        );
        if (otherParticipantId) {
          const userDoc = await getDoc(doc(db, "users", otherParticipantId));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserData;
            // Check translation usage
            const canTranslate = await checkAndIncrementUsage(userId, "translations");
            if (canTranslate) {
              const translatedContent = await translateMessage(
                textToTranslate,
                userData.preferredLang || "en"
              );
              messageData.content = translatedContent;
            } else {
              messageData.content = textToTranslate;
              // message wasn't translated due to usage limits
            }
          }
        }
      } else if (chatData?.type === "group") {
        const translations: { [key: string]: string } = {};
        await Promise.all(
          participantLanguages.map(async (lang) => {
            // Check translation usage for each language
            const canTranslate = await checkAndIncrementUsage(userId, "translations");
            if (canTranslate) {
              translations[lang] = await translateMessage(textToTranslate, lang);
            } else {
              translations[lang] = textToTranslate;
              // message wasn't translated due to usage limits
            }
          })
        );
        messageData.content = translations;
      } else if (chatData?.type === "ai") {
        // For AI chat, we don't translate the message
        messageData.content = textToTranslate;
        // Check AI interaction usage
        const canUseAI = await checkAndIncrementUsage(userId, "aiInteractions");
        if (!canUseAI) {
          throw new Error("You've reached your AI interaction limit for the free tier. Please upgrade to continue using AI chat.");
        }
      }
    }

    console.log("ADDING MESSAGE", messageData);
    await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

const translateMessage = async (
  message: string,
  targetLang: string
): Promise<string> => {
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY;
  const API_URL = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_URL;

  try {
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: message,
        target: targetLang,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Translation API error:', response.status, errorBody);
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error) {
    console.error('Error in translation:', error);
    return message; // Return original message if translation fails
  }
};