SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS services (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL DEFAULT '', duration_minutes INT NOT NULL, price DECIMAL(10,2) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS barbers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS clients (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, phone VARCHAR(20) NOT NULL, INDEX client_lookup (phone, name));
CREATE TABLE IF NOT EXISTS appointments (
 id INT AUTO_INCREMENT PRIMARY KEY, client_id INT NULL, client_name VARCHAR(100) NOT NULL, client_phone VARCHAR(20), barber_id INT NOT NULL, service_id INT NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL,
 status ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'confirmed',
 FOREIGN KEY (client_id) REFERENCES clients(id), FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (service_id) REFERENCES services(id), INDEX agenda_lookup (barber_id, start_time, end_time));
CREATE TABLE IF NOT EXISTS barber_services (barber_id INT NOT NULL, service_id INT NOT NULL, PRIMARY KEY (barber_id, service_id), FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (service_id) REFERENCES services(id));
CREATE TABLE IF NOT EXISTS working_hours (id INT AUTO_INCREMENT PRIMARY KEY, barber_id INT NOT NULL, weekday TINYINT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, FOREIGN KEY (barber_id) REFERENCES barbers(id), INDEX workday_lookup (barber_id, weekday));
CREATE TABLE IF NOT EXISTS blocks (id INT AUTO_INCREMENT PRIMARY KEY, barber_id INT NOT NULL, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL, reason VARCHAR(250) NOT NULL, FOREIGN KEY (barber_id) REFERENCES barbers(id), INDEX block_lookup (barber_id, start_time));
CREATE TABLE IF NOT EXISTS admins (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(60) NOT NULL UNIQUE, password_hash VARCHAR(200) NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash CHAR(64) PRIMARY KEY, admin_id INT NOT NULL, expires_at DATETIME NOT NULL, FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS appointment_events (id INT AUTO_INCREMENT PRIMARY KEY, appointment_id INT NOT NULL, action VARCHAR(50) NOT NULL, detail TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (appointment_id) REFERENCES appointments(id));
CREATE TABLE IF NOT EXISTS schedule_mutex (id INT PRIMARY KEY);
INSERT IGNORE INTO schedule_mutex (id) VALUES (1);
CREATE TABLE IF NOT EXISTS migrations (version INT PRIMARY KEY);
