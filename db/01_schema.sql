-- Schema is the single source of truth (docs/retningslinjer/database.md). No USE, so it also runs against kongarthur_test.
-- No explicit charset: MySQL 8.4 defaults to utf8mb4_0900_ai_ci, so Danish text is stored as UTF-8 and guest name
-- search is case- and accent-insensitive (FR-002).

CREATE TABLE countries (
  code CHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  capacity TINYINT UNSIGNED NOT NULL,
  CHECK (capacity > 0)
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  room_type_id INT NOT NULL,
  FOREIGN KEY (room_type_id) REFERENCES room_types (id)
);

CREATE TABLE seasons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- Periods must cover the year without overlap; MySQL cannot express that, so the seed generator ensures it
CREATE TABLE season_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  season_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CHECK (end_date >= start_date),
  FOREIGN KEY (season_id) REFERENCES seasons (id),
  INDEX (start_date, end_date)
);

CREATE TABLE room_prices (
  room_type_id INT NOT NULL,
  season_id INT NOT NULL,
  price_per_night DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (room_type_id, season_id),
  CHECK (price_per_night >= 0),
  FOREIGN KEY (room_type_id) REFERENCES room_types (id),
  FOREIGN KEY (season_id) REFERENCES seasons (id)
);

-- No room_type_id: the type is derived from rooms.room_type_id, storing it here would be a transitive dependency (3NF)
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- First and family name are two facts, as in the assignment's data (1NF, 004 FR-006)
  first_name VARCHAR(75) NOT NULL,
  family_name VARCHAR(75) NOT NULL,
  country_code CHAR(2) NOT NULL,
  room_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_count TINYINT UNSIGNED NOT NULL,
  -- Deliberate exception: the price at booking/edit time is a frozen historical fact (FR-009)
  total_price DECIMAL(10, 2) NOT NULL,
  source ENUM('backoffice', 'booking_system') NOT NULL DEFAULT 'backoffice',
  -- NULL = not registered; set at check-out (003 FR-011)
  satisfaction_score TINYINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
  CHECK (CHAR_LENGTH(TRIM(family_name)) > 0),
  CHECK (check_out > check_in),
  CHECK (guest_count > 0),
  CHECK (total_price >= 0),
  CHECK (satisfaction_score BETWEEN 1 AND 5),
  FOREIGN KEY (country_code) REFERENCES countries (code),
  FOREIGN KEY (room_id) REFERENCES rooms (id),
  INDEX (room_id, check_in, check_out),
  -- No index on the names: the search is LIKE '%…%', which a B-tree index cannot use
  INDEX (check_in)
);

CREATE TABLE drink_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE drinks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  drink_category_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  CHECK (price >= 0),
  FOREIGN KEY (drink_category_id) REFERENCES drink_categories (id)
);

CREATE TABLE bar_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drink_id INT NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  -- Deliberate exception: the drink's price at the time of sale is a frozen historical fact (FR-010)
  unit_price DECIMAL(10, 2) NOT NULL,
  sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booking_id INT NULL,
  CHECK (quantity >= 1),
  CHECK (unit_price >= 0),
  FOREIGN KEY (drink_id) REFERENCES drinks (id),
  -- The sale is kept when the booking is deleted (FR-010a)
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  INDEX (sold_at)
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);
