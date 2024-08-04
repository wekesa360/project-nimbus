import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { User, Users, X, Bot, Link, Mail, Check, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface User {
  id: string
  username: string
  email: string
}

interface CreateNewChatProps {
  chatType: 'private' | 'group' | 'ai'
  onClose: () => void
}

export default function CreateNewChat({ chatType, onClose }: CreateNewChatProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<'username' | 'email'>('username')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [groupName, setGroupName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [chatLink, setChatLink] = useState('')
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createWithoutUsers, setCreateWithoutUsers] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  const handleSearch = async () => {
    if (!searchTerm) return

    const usersRef = collection(db, 'users')
    let q;
    if (searchType === 'username') {
      q = query(usersRef, where('username', '==', searchTerm))
    } else {
      q = query(usersRef, where('email', '==', searchTerm))
    }
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const user = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as User
      if (user.id !== session?.user?.id) {
        handleSelectUser(user)
      }
    } else {
      setShowInvite(true)
      setInviteEmail(searchType === 'email' ? searchTerm : '')
    }
    setSearchTerm('')
  }

  const handleSelectUser = (user: User) => {
    if (!selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setShowInvite(false)
  }

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(user => user.id !== userId))
  }

  const handleInvite = async () => {
    if (!session?.user?.id) return
    setIsLoading(true)
    try {
      const chatData = {
        type: 'private',
        participants: [session.user.id],
        createdAt: serverTimestamp(),
        createdBy: session.user.id
      }
  
      const docRef = await addDoc(collection(db, 'chats'), chatData)
      const chatId = docRef.id
  
      const invitationLink = `${window.location.origin}/invite?token=${chatId}`
  
      await sendInvitation(invitationLink, inviteEmail)
  
      setChatLink(invitationLink)
      setShowInvite(false)
      onClose()
    } catch (error) {
      console.error('Error sending invitation:', error)
      setError('Failed to send invitation. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const sendInvitation = async (link: string, email: string) => {
    console.log(`Invitation sent to ${email}: ${link}`)
    
    await addDoc(collection(db, 'invitations'), {
      chatId: link.split('/').pop(),
      email: email,
      sentAt: serverTimestamp()
    })
  }
  
  const handleCreateChat = async () => {
    if (!session?.user?.id) return
    if (chatType === 'private' && selectedUsers.length !== 1 && !showInvite && !createWithoutUsers) return
    if (chatType === 'group' && selectedUsers.length === 0 && !createWithoutUsers) return
  
    setIsLoading(true)
    try {
      if (chatType === 'private' && showInvite) {
        await handleInvite()
        return
      }
  
      const chatData = {
        type: chatType,
        participants: [session.user.id],
        createdAt: serverTimestamp(),
        createdBy: session.user.id,
        ...(chatType === 'group' && { name: groupName || 'New Group Chat' }),
        ...(chatType === 'ai' && { aiModel: 'gpt-3.5-turbo' })
      }
  
      const docRef = await addDoc(collection(db, 'chats'), chatData)
      const chatId = docRef.id
  
      const invitationLink = `${window.location.origin}/invite?token=${chatId}`
  
      if (chatType === 'private' && selectedUsers.length === 1 && !createWithoutUsers) {
        await updateDoc(doc(db, 'chats', chatId), {
          participants: arrayUnion(selectedUsers[0].id)
        })
        setChatLink(`${window.location.origin}/chat/${chatId}`)
      } else {
        setChatLink(invitationLink)
        
        if (!createWithoutUsers) {
          for (const user of selectedUsers) {
            await sendInvitation(invitationLink, user.email)
          }
        }
      }
  
      setSuccessMessage('Chat created successfully!')
    } catch (error) {
      console.error('Error creating chat:', error)
      setError('Failed to create chat. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(chatLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg p-8 w-full max-w-2xl shadow-xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">
              {chatType === 'private' && 'Create Private Chat'}
              {chatType === 'group' && 'Create Group Chat'}
              {chatType === 'ai' && 'Create AI Chat'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
              <X size={24} />
            </button>
          </div>

          {chatType === 'group' && (
            <div className="mb-6">
              <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="input input-bordered w-full bg-white text-base"
                placeholder="Enter group name"
              />
            </div>
          )}

          {chatType !== 'ai' && (
            <>
              <div className="mb-6">
                <label htmlFor="searchUsers" className="block text-sm font-medium text-gray-700 mb-2">
                  Add User
                </label>
                <div className="flex mb-2">
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as 'username' | 'email')}
                    className="select select-bordered flex-shrink-0 mr-2"
                  >
                    <option value="username">Username</option>
                    <option value="email">Email</option>
                  </select>
                  <input
                    type="text"
                    id="searchUsers"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input input-bordered flex-grow"
                    placeholder={`Enter ${searchType}`}
                  />
                  <button
                    onClick={handleSearch}
                    className="btn btn-primary ml-2"
                  >
                    Add
                  </button>
                </div>
              </div>

              {showInvite && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <div className="alert alert-info">
                    <div>
                      <span>User not found. Send an invitation?</span>
                    </div>
                  </div>
                  <div className="flex mt-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="input input-bordered flex-grow"
                      placeholder="Enter email"
                    />
                    <button
                      onClick={handleInvite}
                      className="btn btn-primary ml-2"
                    >
                      Invite
                    </button>
                  </div>
                </motion.div>
              )}

              {selectedUsers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Users</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm flex items-center"
                      >
                        <User size={14} className="mr-1" />
                        {user.username}
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="ml-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createWithoutUsers}
                    onChange={(e) => setCreateWithoutUsers(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Create chat without adding users (generate invitation link)
                  </span>
                </label>
              </div>
            </>
          )}

          {chatType === 'ai' && (
            <div className="mb-6">
              <div className="alert alert-info">
                <div>
                  <span>You're creating an AI chat. This will start a conversation with our AI assistant.</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error mb-4">
              <div>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {successMessage && (
            <div className="alert alert-success mb-4">
              <div>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {!chatLink && (
            <button
              onClick={handleCreateChat}
              disabled={isLoading}
              className="btn btn-primary w-full text-lg"
            >
              {isLoading ? 'Creating...' : 'Create Chat'}
            </button>
          )}

          {chatLink && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <h3 className="text-xl font-medium text-gray-700 mb-3">Invitation Link</h3>
              <div className="flex items-center bg-gray-100 p-4 rounded-lg">
                <input
                  type="text"
                  value={chatLink}
                  readOnly
                  className="bg-transparent flex-1 outline-none text-base mr-2"
                />
                <button
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                >
                  {linkCopied ? (
                    <>
                      <Check size={20} className="mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={20} className="mr-2" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Share this link to invite others to the chat.
              </p>
              <div className="mt-6 flex justify-end">
                <button onClick={onClose} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}