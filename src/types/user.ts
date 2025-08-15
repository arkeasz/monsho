export interface Account {
  uid: string
  username: string
  role: 'worker' | 'admin'
  createdAt: string
  updatedAt: string
}
