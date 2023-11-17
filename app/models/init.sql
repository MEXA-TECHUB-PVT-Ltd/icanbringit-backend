CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  otp TEXT,
  signup_type TEXT,
  role TEXT DEFAULT 'user',
  verify_email BOOL DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  google_access_token TEXT DEFAULT NULL,
  apple_access_token TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255),
  file_type VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_bio(
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  gender TEXT,
  age INT,
  city TEXT,
  country TEXT,
  uploads_id INT REFERENCES uploads(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS event_types(
  id SERIAL PRIMARY KEY,
  text TEXT,
  options TEXT [],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS food_preference(
  id SERIAL PRIMARY KEY,
  text TEXT,
  options TEXT [],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
