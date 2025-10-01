import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// In-memory user store (replace with a real database in production)
const users = new Map();

class User {
  constructor({ email, password, name = '' }) {
    this.id = uuidv4();
    this.email = email.toLowerCase();
    this.password = bcrypt.hashSync(password, 10);
    this.name = name;
    this.isEmailVerified = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async create(userData) {
    if (users.has(userData.email.toLowerCase())) {
      throw new Error('User already exists');
    }
    const user = new User(userData);
    users.set(user.email, user);
    return user;
  }

  static async findByEmail(email) {
    return users.get(email.toLowerCase()) || null;
  }

  static async findById(id) {
    return Array.from(users.values()).find(user => user.id === id) || null;
  }

  async validatePassword(password) {
    return bcrypt.compare(password, this.password);
  }

  toJSON() {
    const { password, ...user } = this;
    return user;
  }
}

export default User;
