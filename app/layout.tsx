import { Inter } from 'next/font/google'
import './globals.css'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import SessionProvider from '@/components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          <main>
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}