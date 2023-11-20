CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255),
  file_type VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  otp TEXT,
  signup_type TEXT,
  role TEXT DEFAULT 'user',
  verify_email BOOL DEFAULT FALSE,
  full_name TEXT,
  gender TEXT,
  age INT,
  city TEXT,
  country TEXT,
  uploads_id INT REFERENCES uploads(id) ON DELETE CASCADE,
  location JSONB,
  block_status BOOLEAN DEFAULT FALSE,
  payment_status BOOLEAN DEFAULT FALSE,
  total_events INT DEFAULT 0,
  total_attendee INT DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  google_access_token TEXT DEFAULT NULL,
  facebook_access_token TEXT DEFAULT NULL,
  apple_access_token TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS question_types(
  id SERIAL PRIMARY KEY,
  text TEXT,
  options TEXT [],
  type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS question_type_responses(
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_types_id INT NOT NULL REFERENCES question_types(id) ON DELETE CASCADE,
  text TEXT,
  type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS events(
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  cover_photo_id INT REFERENCES uploads(id) ON DELETE CASCADE,
  start_timestamp TIMESTAMP WITH TIME ZONE,
  -- Combined start date and time
  end_timestamp TIMESTAMP WITH TIME ZONE,
  -- Combined end date and time
  event_type TEXT,
  -- online or onsite
  virtual_link TEXT,
  -- online type
  location JSONB,
  -- onsite type
  event_details TEXT,
  no_guests INT,
  privacy TEXT,
  -- public or private
  suggested_items TEXT [],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendee_tasks(
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- assigned event
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- assigned user
  text TEXT,
  items TEXT [],
  start_timestamp TIMESTAMP WITH TIME ZONE,
  end_timestamp TIMESTAMP WITH TIME ZONE,
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendee(
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, 
  status BOOLEAN DEFAULT FALSE,
  accepted TEXT DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

