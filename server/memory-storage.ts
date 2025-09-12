// In-memory user storage for development when Supabase RLS blocks inserts
import bcrypt from 'bcrypt';

interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  password: string | null;
  bio: string | null;
  avatar: string | null;
  supabaseId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InsertUser {
  email: string;
  username: string;
  name: string;
  password: string | null;
  bio?: string | null;
  avatar?: string | null;
  supabaseId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

class MemoryUserStore {
  private users: Map<number, User> = new Map();
  private emailIndex: Map<string, number> = new Map();
  private usernameIndex: Map<string, number> = new Map();
  private nextId = 10001;

  constructor() {
    console.log('Initializing in-memory user store for development');
  }

  async getUserById(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async insertUser(userData: InsertUser): Promise<User | null> {
    try {
      // Check if user already exists
      if (this.emailIndex.has(userData.email.toLowerCase())) {
        console.log('Memory store: User already exists with email:', userData.email);
        return null;
      }

      if (this.usernameIndex.has(userData.username.toLowerCase())) {
        console.log('Memory store: User already exists with username:', userData.username);
        return null;
      }

      const userId = this.nextId++;
      const now = new Date().toISOString();
      
      const user: User = {
        id: userId,
        email: userData.email,
        username: userData.username,
        name: userData.name,
        password: userData.password,
        bio: userData.bio || null,
        avatar: userData.avatar || null,
        supabaseId: userData.supabaseId || null,
        stripeCustomerId: userData.stripeCustomerId || null,
        stripeSubscriptionId: userData.stripeSubscriptionId || null,
        createdAt: now,
        updatedAt: now
      };

      this.users.set(userId, user);
      this.emailIndex.set(userData.email.toLowerCase(), userId);
      this.usernameIndex.set(userData.username.toLowerCase(), userId);

      console.log('Memory store: Created user with ID:', userId, 'email:', userData.email);
      return user;
    } catch (error) {
      console.error('Memory store insertUser error:', error);
      return null;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  getStats() {
    return {
      totalUsers: this.users.size,
      nextId: this.nextId
    };
  }
}

export const memoryUserStore = new MemoryUserStore();