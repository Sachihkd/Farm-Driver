import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { format } from "date-fns";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "flower-farm-secret-key";

// Database Initialization
const DATABASE_URL = process.env.DATABASE_URL;
let db: any;
let isPostgres = false;

if (DATABASE_URL && DATABASE_URL.trim() !== "" && DATABASE_URL.startsWith("postgres") && !DATABASE_URL.includes("placeholder") && !DATABASE_URL.includes("your_")) {
  console.log("Using PostgreSQL (Neon)");
  try {
    db = postgres(DATABASE_URL, { 
      ssl: 'require',
      connect_timeout: 30,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      max: 10,
      onnotice: () => {} // Suppress notices
    });
    isPostgres = true;
  } catch (err) {
    console.error("PostgreSQL initialization failed, falling back to SQLite:", err);
    isPostgres = false;
    db = new Database(path.join(__dirname, "flower_farm.db"));
  }
} else {
  if (DATABASE_URL && DATABASE_URL.trim() !== "") {
    console.warn("DATABASE_URL provided but does not look like a valid PostgreSQL URL. Falling back to SQLite.");
  }
  console.log("Using SQLite (Local)");
  db = new Database(path.join(__dirname, "flower_farm.db"));
}

// Helper for DB queries to handle both SQLite and Postgres
const query = async (sql: string, params: any[] = []) => {
  if (isPostgres) {
    let i = 1;
    let pgSql = sql.replace(/\?/g, () => `$${i++}`);
    if (pgSql.toUpperCase().includes("INSERT OR REPLACE")) {
      pgSql = pgSql.replace(/INSERT OR REPLACE INTO (\w+) \((.*?)\) VALUES \((.*?)\)/i, (match, table, cols, vals) => {
        const colList = cols.split(',').map((c: string) => c.trim());
        const updateList = colList.filter((c: string) => c.toLowerCase() !== 'key').map((c: string) => `${c} = EXCLUDED.${c}`).join(', ');
        return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (key) DO UPDATE SET ${updateList}`;
      });
    }
    if (sql.trim().toUpperCase().startsWith("INSERT") && !pgSql.toUpperCase().includes("RETURNING")) {
      pgSql += " RETURNING id";
    }
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const result = await db.unsafe(pgSql, params);
        if (sql.trim().toUpperCase().startsWith("INSERT")) {
          return { lastInsertRowid: result[0]?.id, rows: result };
        }
        return result;
      } catch (err) {
        if (retries === 0) throw err;
        console.warn(`Query failed, retrying... (${err})`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } else {
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith("SELECT")) {
      return stmt.all(...params);
    } else {
      const result = stmt.run(...params);
      return { lastInsertRowid: result.lastInsertRowid, rows: [] };
    }
  }
};

const queryOne = async (sql: string, params: any[] = []) => {
  if (isPostgres) {
    let i = 1;
    const pgSql = sql.replace(/\?/g, () => `$${i++}`);
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const rows = await db.unsafe(pgSql, params);
        return rows[0];
      } catch (err) {
        if (retries === 0) throw err;
        console.warn(`QueryOne failed, retrying... (${err})`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } else {
    return db.prepare(sql).get(...params);
  }
};

const initDb = async () => {
  console.log(`Initializing ${isPostgres ? 'PostgreSQL' : 'SQLite'} database...`);
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS companies (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      logo TEXT,
      wallpaper TEXT,
      retention_days INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      full_name TEXT NOT NULL,
      user_id TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      company_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS trips (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      driver_id INTEGER NOT NULL,
      vehicle_number TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      company_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS trip_events (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      trip_id INTEGER NOT NULL,
      stage INTEGER NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION
    )`,
    `CREATE TABLE IF NOT EXISTS mobile_numbers (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      company_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS email_ids (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS api_settings (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      company_id INTEGER,
      UNIQUE(key, company_id)
    )`,
    `CREATE TABLE IF NOT EXISTS vehicles (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      vehicle_number TEXT NOT NULL,
      model TEXT,
      company_id INTEGER,
      UNIQUE(vehicle_number, company_id)
    )`,
    `CREATE TABLE IF NOT EXISTS vehicle_checks (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      trip_id INTEGER,
      driver_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      vehicle_number TEXT NOT NULL,
      check_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    let retries = 3;
    while (retries > 0) {
      try {
        if (isPostgres) {
          await db.unsafe(sql);
        } else {
          db.exec(sql);
        }
        break; // Success
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error(`Error creating table after 3 attempts: ${err}`);
          throw err;
        }
        console.warn(`Retrying table creation (${3 - retries}/3) due to error: ${err}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  if (isPostgres) {
    // Add company_id columns if they don't exist (migration)
    const migrationTables = ['users', 'trips', 'mobile_numbers', 'email_ids', 'api_settings', 'vehicles'];
    for (const table of migrationTables) {
      try {
        await db.unsafe(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER`);
      } catch (e) {}
    }
    try {
      await db.unsafe(`ALTER TABLE api_settings DROP CONSTRAINT IF EXISTS api_settings_key_key`);
      await db.unsafe(`ALTER TABLE api_settings ADD CONSTRAINT api_settings_key_company_id_unique UNIQUE(key, company_id)`);
    } catch (e) {}
    try {
      await db.unsafe(`ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_number_key`);
      await db.unsafe(`ALTER TABLE vehicles ADD CONSTRAINT vehicles_number_company_id_unique UNIQUE(vehicle_number, company_id)`);
    } catch (e) {}
  } else {
    // SQLite migration
    const migrationTables = ['users', 'trips', 'mobile_numbers', 'email_ids', 'api_settings', 'vehicles'];
    for (const table of migrationTables) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER`);
      } catch (e) {}
    }
  }

  // Seed Default Company if none exists
  let defaultCompany = await queryOne("SELECT * FROM companies LIMIT 1");
  if (!defaultCompany) {
    console.log("Seeding default company...");
    const result = await query("INSERT INTO companies (name, code) VALUES (?, ?)", ["Default Company", "DEFAULT"]);
    defaultCompany = { id: result.lastInsertRowid, name: "Default Company", code: "DEFAULT" };
  }

  // Seed Admin
  const admin = await queryOne("SELECT * FROM users WHERE user_id = ?", ["admin"]);
  if (!admin) {
    console.log("Seeding admin user...");
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    await query("INSERT INTO users (full_name, user_id, password, role, company_id) VALUES (?, ?, ?, ?, ?)", 
      ["System Admin", "admin", hashedPassword, "admin", defaultCompany.id]);
  } else if (!admin.company_id) {
    await query("UPDATE users SET company_id = ? WHERE id = ?", [defaultCompany.id, admin.id]);
  }
  
  console.log("Database initialization complete.");
};

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get("/api/health", async (req, res) => {
  try {
    const dbType = isPostgres ? "PostgreSQL (Neon)" : "SQLite (Local)";
    const user = await queryOne("SELECT COUNT(*) as count FROM users");
    res.json({ 
      status: "ok", 
      database: dbType, 
      users: user ? Number(user.count) : 0,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/test-email", authenticate, async (req: any, res) => {
  try {
    const company_id = req.body.company_id || req.user.company_id;
    // If user is not admin, they can only test their own company's settings
    if (req.user.role !== 'admin' && company_id != req.user.company_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const dummyTrip = { id: -1, driver_id: -1, vehicle_number: 'TEST-001' };
    const error = await sendNotifications(dummyTrip, 4, company_id);
    if (error) {
      res.status(400).json({ message: error });
    } else {
      res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// --- API Routes ---
app.post("/api/login", async (req, res) => {
  const { user_id, password } = req.body;
  console.log(`Login attempt for user_id: ${user_id}`);
  const user = await queryOne("SELECT * FROM users WHERE user_id = ?", [user_id]);

  if (!user) {
    console.log(`User not found: ${user_id}`);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    console.log(`Password mismatch for user: ${user_id}`);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, role: user.role, full_name: user.full_name, company_id: user.company_id }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role, user_id: user.user_id, company_id: user.company_id } });
});

// Companies Management
app.get("/api/companies", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const companies = await query("SELECT * FROM companies");
  res.json(companies);
});

app.post("/api/companies", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { name, code, logo, wallpaper, retention_days } = req.body;
  try {
    await query("INSERT INTO companies (name, code, logo, wallpaper, retention_days) VALUES (?, ?, ?, ?, ?)", [
      name, code, logo, wallpaper, retention_days || 0
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Company code already exists" });
  }
});

app.put("/api/companies/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { name, code, logo, wallpaper, retention_days } = req.body;
  await query("UPDATE companies SET name = ?, code = ?, logo = ?, wallpaper = ?, retention_days = ? WHERE id = ?", [
    name, code, logo, wallpaper, retention_days, req.params.id
  ]);
  res.json({ success: true });
});

app.delete("/api/companies/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  await query("DELETE FROM companies WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

app.get("/api/companies/my", authenticate, async (req: any, res) => {
  const company = await queryOne("SELECT * FROM companies WHERE id = ?", [req.user.company_id]);
  res.json(company);
});

// Public Vehicles for Login
app.get("/api/public/user-company/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const user = await queryOne("SELECT company_id FROM users WHERE user_id = ?", [user_id]);
  if (!user) {
    return res.status(404).json({ error: "Invalid user id" });
  }
  const company = await queryOne("SELECT id, name, code, logo FROM companies WHERE id = ?", [user.company_id]);
  res.json({ company_id: user.company_id, company });
});

app.post("/api/public/validate-password", async (req, res) => {
  const { user_id, password } = req.body;
  const user = await queryOne("SELECT password FROM users WHERE user_id = ?", [user_id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({ success: true });
});

app.get("/api/public/vehicles", async (req, res) => {
  const { companyCode, companyId } = req.query;
  let company;
  if (companyId) {
    company = { id: companyId };
  } else if (companyCode) {
    company = await queryOne("SELECT id FROM companies WHERE code = ?", [companyCode]);
  } else {
    company = await queryOne("SELECT id FROM companies LIMIT 1");
  }

  if (!company) return res.json([]);

  const vehicles = await query("SELECT id, vehicle_number, model FROM vehicles WHERE company_id = ?", [company.id]);
  res.json(vehicles);
});

// Users Management
app.get("/api/users", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  // Admins can see all users
  const users = await query("SELECT id, full_name, user_id, role, company_id FROM users");
  res.json(users);
});

app.post("/api/users", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { full_name, user_id, password, role, company_id } = req.body;
  const targetCompanyId = company_id || req.user.company_id;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    await query("INSERT INTO users (full_name, user_id, password, role, company_id) VALUES (?, ?, ?, ?, ?)", [
      full_name,
      user_id,
      hashedPassword,
      role,
      targetCompanyId
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "User ID already exists" });
  }
});

app.put("/api/users/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { full_name, user_id, password, role, company_id } = req.body;
  const { id } = req.params;
  
  try {
    if (password && password !== '********') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await query("UPDATE users SET full_name = ?, user_id = ?, password = ?, role = ?, company_id = ? WHERE id = ?", [
        full_name, user_id, hashedPassword, role, company_id || req.user.company_id, id
      ]);
    } else {
      await query("UPDATE users SET full_name = ?, user_id = ?, role = ? , company_id = ? WHERE id = ?", [
        full_name, user_id, role, company_id || req.user.company_id, id
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Update failed" });
  }
});

app.delete("/api/users/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  await query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// Mobile Numbers
app.get("/api/mobile-numbers", authenticate, async (req: any, res) => {
  let sql = "SELECT * FROM mobile_numbers WHERE company_id = ?";
  let params = [req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "SELECT * FROM mobile_numbers";
    params = [];
  }
  const numbers = await query(sql, params);
  res.json(numbers);
});

app.post("/api/mobile-numbers", authenticate, async (req: any, res) => {
  const { name, number, company_id } = req.body;
  await query("INSERT INTO mobile_numbers (name, number, company_id) VALUES (?, ?, ?)", [name, number, company_id || req.user.company_id]);
  res.json({ success: true });
});

app.put("/api/mobile-numbers/:id", authenticate, async (req: any, res) => {
  const { name, number, company_id } = req.body;
  await query("UPDATE mobile_numbers SET name = ?, number = ?, company_id = ? WHERE id = ?", [name, number, company_id || req.user.company_id, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/mobile-numbers/:id", authenticate, async (req: any, res) => {
  let sql = "DELETE FROM mobile_numbers WHERE id = ? AND company_id = ?";
  let params = [req.params.id, req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "DELETE FROM mobile_numbers WHERE id = ?";
    params = [req.params.id];
  }
  await query(sql, params);
  res.json({ success: true });
});

// Email IDs
app.get("/api/email-ids", authenticate, async (req: any, res) => {
  let sql = "SELECT * FROM email_ids WHERE company_id = ?";
  let params = [req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "SELECT * FROM email_ids";
    params = [];
  }
  const emails = await query(sql, params);
  res.json(emails);
});

app.post("/api/email-ids", authenticate, async (req: any, res) => {
  const { name, email, company_id } = req.body;
  await query("INSERT INTO email_ids (name, email, company_id) VALUES (?, ?, ?)", [name, email, company_id || req.user.company_id]);
  res.json({ success: true });
});

app.put("/api/email-ids/:id", authenticate, async (req: any, res) => {
  const { name, email, company_id } = req.body;
  await query("UPDATE email_ids SET name = ?, email = ?, company_id = ? WHERE id = ?", [name, email, company_id || req.user.company_id, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/email-ids/:id", authenticate, async (req: any, res) => {
  let sql = "DELETE FROM email_ids WHERE id = ? AND company_id = ?";
  let params = [req.params.id, req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "DELETE FROM email_ids WHERE id = ?";
    params = [req.params.id];
  }
  await query(sql, params);
  res.json({ success: true });
});

// Vehicles
app.get("/api/vehicles", authenticate, async (req: any, res) => {
  let sql = "SELECT * FROM vehicles WHERE company_id = ?";
  let params = [req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "SELECT * FROM vehicles";
    params = [];
  }
  const vehicles = await query(sql, params);
  res.json(vehicles);
});

app.post("/api/vehicles", authenticate, async (req: any, res) => {
  const { vehicle_number, model, company_id } = req.body;
  try {
    await query("INSERT INTO vehicles (vehicle_number, model, company_id) VALUES (?, ?, ?)", [vehicle_number, model, company_id || req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Vehicle number already exists for this company" });
  }
});

app.put("/api/vehicles/:id", authenticate, async (req: any, res) => {
  const { vehicle_number, model, company_id } = req.body;
  await query("UPDATE vehicles SET vehicle_number = ?, model = ?, company_id = ? WHERE id = ?", [vehicle_number, model, company_id || req.user.company_id, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/vehicles/:id", authenticate, async (req: any, res) => {
  let sql = "DELETE FROM vehicles WHERE id = ? AND company_id = ?";
  let params = [req.params.id, req.user.company_id];
  if (req.user.role === 'admin') {
    sql = "DELETE FROM vehicles WHERE id = ?";
    params = [req.params.id];
  }
  await query(sql, params);
  res.json({ success: true });
});

// Trips
// Helper for notifications
const sendNotifications = async (trip: any, stage: number, companyId: number) => {
  const stageNames = ['', 'Trip Start', 'Reached Airport', 'Offloaded & Return', 'Trip Complete'];
  const event = await queryOne("SELECT * FROM trip_events WHERE trip_id = ? AND stage = ?", [trip.id, stage]);
  const driver = await queryOne("SELECT full_name FROM users WHERE id = ?", [trip.driver_id]);
  const driverName = driver ? driver.full_name : 'System Test';
  
  const content = `
    Driver: ${driverName}
    Vehicle: ${trip.vehicle_number}
    Action: ${stageNames[stage]}
    Time: ${event ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString()}
    Location: ${event ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}` : 'N/A'}
  `;

  const settingsRows = await query("SELECT * FROM api_settings WHERE company_id = ?", [companyId]);
  const settings = settingsRows.reduce((acc: any, curr: any) => {
    acc[curr.key] = JSON.parse(curr.value);
    return acc;
  }, {} as any);

  const errors: string[] = [];

  // SMS
  if (settings.smsUrl && settings.smsKey && settings.smsClientId) {
    const numbers = await query("SELECT number FROM mobile_numbers WHERE company_id = ?", [companyId]);
    if (numbers.length > 0) {
      try {
        const messageParameters = numbers.map(num => {
          let phone = num.number;
          if (phone.startsWith('0')) {
            phone = '+254' + phone.substring(1);
          }
          return {
            Number: phone,
            Text: content
          };
        });

        const payload = {
          SenderId: settings.smsSenderId,
          IsUnicode: true,
          IsFlash: false,
          ScheduleDateTime: "",
          MessageParameters: messageParameters,
          ApiKey: settings.smsKey,
          ClientId: settings.smsClientId
        };

        const response = await fetch(settings.smsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SMS API Error Response] ${response.status}:`, errorText);
          throw new Error(`SMS API returned ${response.status}: ${errorText.substring(0, 100)}`);
        } else {
          const resData = await response.json();
          // Check for internal errors in data array as per VBA logic
          if (resData.Data && Array.isArray(resData.Data)) {
            const failed = resData.Data.filter((m: any) => m.MessageErrorCode !== 0 && m.MessageErrorCode !== "0");
            if (failed.length > 0) {
              console.error(`[SMS Internal Error]:`, failed);
              errors.push(`${failed.length} SMS messages failed to send`);
            }
          }
        }
      } catch (err: any) {
        console.error(`[SMS Error]:`, err.message);
        errors.push(`SMS failed: ${err.message}`);
      }
    }
  }

  // Email on Trip Complete
  if (stage === 4) {
    console.log(`[Email Debug] Trip Complete detected. Checking settings...`);
    if (settings.smtpHost && settings.smtpUser && settings.smtpPass) {
      const emails = await query("SELECT email FROM email_ids WHERE company_id = ?", [companyId]);
      console.log(`[Email Debug] Found ${emails.length} recipient(s)`);
      
      if (emails.length > 0) {
        try {
          // Fetch all events for this trip for a detailed report
          const events = await query("SELECT * FROM trip_events WHERE trip_id = ? ORDER BY stage ASC", [trip.id]);
          const startTime = new Date(events[0].timestamp);
          const endTime = new Date(events[events.length - 1].timestamp);
          
          const totalDurMs = endTime.getTime() - startTime.getTime();
          const totalHours = Math.floor(totalDurMs / 3600000).toString().padStart(2, '0');
          const totalMinutes = Math.floor((totalDurMs % 3600000) / 60000).toString().padStart(2, '0');
          const totalDurTable = `${totalHours}:${totalMinutes}`;

          const getStageTime = (s: number) => events.find((e: any) => e.stage === s)?.timestamp;
          const formatDur = (ms: number) => {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return `${h}h ${m}m`;
          };

          const s1Time = getStageTime(1);
          const s2Time = getStageTime(2);
          const s3Time = getStageTime(3);
          const s4Time = getStageTime(4);

          const dur1to2 = s1Time && s2Time ? formatDur(new Date(s2Time).getTime() - new Date(s1Time).getTime()) : '0h 0m';
          const dur2to3 = s2Time && s3Time ? formatDur(new Date(s3Time).getTime() - new Date(s2Time).getTime()) : '0h 0m';
          const dur3to4 = s3Time && s4Time ? formatDur(new Date(s4Time).getTime() - new Date(s3Time).getTime()) : '0h 0m';

          const companyName = settings.companyName || "FLORA TRACK";
          
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
              <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${companyName}</h2>
              </div>
              
              <div style="background-color: #2d7a4d; color: white; padding: 15px; text-align: center; border-radius: 4px 4px 0 0;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px; text-transform: uppercase;">${companyName}</h1>
                <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Official Trip Completion Report</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #ddd;">
                <tr style="background-color: #f8f8f8; text-align: left;">
                  <th style="padding: 12px; border: 1px solid #ddd; font-size: 14px;">Driver Name</th>
                  <th style="padding: 12px; border: 1px solid #ddd; font-size: 14px;">Vehicle</th>
                  <th style="padding: 12px; border: 1px solid #ddd; font-size: 14px;">Started</th>
                  <th style="padding: 12px; border: 1px solid #ddd; font-size: 14px;">Completed</th>
                  <th style="padding: 12px; border: 1px solid #ddd; font-size: 14px;">Duration</th>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd;">${driverName}</td>
                  <td style="padding: 12px; border: 1px solid #ddd;">${trip.vehicle_number}</td>
                  <td style="padding: 12px; border: 1px solid #ddd;">${format(startTime, 'dd-MMM-yyyy HH:mm')}</td>
                  <td style="padding: 12px; border: 1px solid #ddd;">${format(endTime, 'dd-MMM-yyyy HH:mm')}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">${totalDurTable}</td>
                </tr>
              </table>

              <h3 style="color: #2d7a4d; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px;">STAGE ANALYSIS</h3>
              
              <div style="margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2d7a4d;">
                <p style="margin: 0; font-weight: bold;">Start Trip ➔ Reached Airport/Warehouse</p>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">⏱ Duration: ${dur1to2}</p>
              </div>

              <div style="margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2d7a4d;">
                <p style="margin: 0; font-weight: bold;">Reached Airport/Warehouse ➔ Offloading Complete & Return Trip Started</p>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">⏱ Duration: ${dur2to3}</p>
              </div>

              <div style="margin-bottom: 25px; padding: 10px; background: #f9f9f9; border-left: 4px solid #2d7a4d;">
                <p style="margin: 0; font-weight: bold;">Offloading Complete & Return Trip Started ➔ Trip Completed (Reached Farm)</p>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">⏱ Duration: ${dur3to4}</p>
              </div>

              <h3 style="color: #2d7a4d; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px;">DETAILED LOCATION LOG</h3>
              
              <div style="line-height: 1.8;">
                ${events.map((e: any) => {
                  const sNames = ['', 'Start Trip', 'Reached Airport/Warehouse', 'Offloading Complete & Return Trip Started', 'Trip Completed (Reached Farm)'];
                  return `
                    <div style="border-bottom: 1px solid #f0f0f0; padding: 8px 0;">
                      <span style="color: #666;">${format(new Date(e.timestamp), 'dd-MMM-yyyy - HH:mm:ss')}</span> - 
                      <span style="font-weight: bold;">${sNames[e.stage]}</span> | 
                      <a href="https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}" style="color: #2563eb; text-decoration: none; font-size: 14px;">
                        📍 View Map
                      </a>
                    </div>
                  `;
                }).join('')}
              </div>

              <p style="margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                This is an automated report generated by the ${companyName} Tracking System.
              </p>
            </div>
          `;

          const isGmail = settings.smtpHost.includes('gmail.com');
          const transportConfig: any = isGmail ? {
            service: 'gmail',
            auth: {
              user: settings.smtpUser,
              pass: settings.smtpPass,
            }
          } : {
            host: settings.smtpHost,
            port: parseInt(settings.smtpPort) || 587,
            secure: parseInt(settings.smtpPort) === 465,
            auth: {
              user: settings.smtpUser,
              pass: settings.smtpPass,
            },
            tls: {
              rejectUnauthorized: false
            }
          };

          const transporter = nodemailer.createTransport({
            ...transportConfig,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
          });

          await transporter.verify();

          for (const email of emails) {
            try {
              await transporter.sendMail({
                from: `"${companyName}" <${settings.smtpUser}>`,
                to: email.email,
                subject: `DETAILED TRIP REPORT: ${trip.vehicle_number} - ${driverName}`,
                html: htmlContent,
              });
            } catch (err: any) {
              errors.push(`Email to ${email.email} failed: ${err.message}`);
            }
          }
        } catch (err: any) {
          errors.push(err.message);
        }
      } else {
        errors.push("No recipient emails configured");
      }
    } else {
      errors.push("SMTP settings are incomplete");
    }
  }

  return errors.length > 0 ? errors.join('; ') : null;
};

app.post("/api/trips/start", authenticate, async (req: any, res) => {
  const { vehicle_number, latitude, longitude } = req.body;
  const driver_id = req.user.id;
  const company_id = req.user.company_id;

  const activeTrip = await queryOne("SELECT id FROM trips WHERE driver_id = ? AND status = 'active'", [driver_id]);
  if (activeTrip) return res.status(400).json({ error: "You already have an active trip" });

  const result = await query("INSERT INTO trips (driver_id, vehicle_number, company_id) VALUES (?, ?, ?)", [driver_id, vehicle_number, company_id]);
  const trip_id = result.lastInsertRowid;

  await query("INSERT INTO trip_events (trip_id, stage, latitude, longitude) VALUES (?, ?, ?, ?)", [
    trip_id,
    1,
    latitude,
    longitude
  ]);

  const trip = { id: trip_id, driver_id, vehicle_number, status: 'active', created_at: new Date().toISOString(), events: [{ id: -1, trip_id, stage: 1, timestamp: new Date().toISOString(), latitude, longitude }], company_id };
  const notificationError = await sendNotifications(trip, 1, company_id);

  res.json({ ...trip, notificationError });
});

app.post("/api/trips/event", authenticate, async (req: any, res) => {
  const { trip_id, stage, latitude, longitude } = req.body;
  const company_id = req.user.company_id;

  const trip = await queryOne("SELECT * FROM trips WHERE id = ? AND company_id = ?", [trip_id, company_id]);
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  await query("INSERT INTO trip_events (trip_id, stage, latitude, longitude) VALUES (?, ?, ?, ?)", [
    trip_id,
    stage,
    latitude,
    longitude
  ]);

  if (stage === 4) {
    await query("UPDATE trips SET status = 'completed' WHERE id = ?", [trip_id]);
  }

  const notificationError = await sendNotifications(trip, stage, company_id);

  res.json({ success: true, notificationError });
});

app.get("/api/trips/recent", authenticate, async (req: any, res) => {
  const company_id = req.user.company_id;
  if (!company_id) return res.json([]);

  try {
    const trips = await query(`
      SELECT t.*, u.full_name as driver_name 
      FROM trips t 
      JOIN users u ON t.driver_id = u.id 
      WHERE t.company_id = ?
      ORDER BY t.created_at DESC 
      LIMIT 5
    `, [company_id]);
    
    if (!Array.isArray(trips)) return res.json([]);

    const reports = await Promise.all(trips.map(async (trip: any) => {
      const events = await query("SELECT * FROM trip_events WHERE trip_id = ? ORDER BY stage ASC", [trip.id]);
      return { ...trip, events: Array.isArray(events) ? events : [] };
    }));
    res.json(reports);
  } catch (err: any) {
    console.error('Error fetching recent trips:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/trips/active", authenticate, async (req: any, res) => {
  const trip = await queryOne("SELECT * FROM trips WHERE driver_id = ? AND status = 'active' AND company_id = ?", [req.user.id, req.user.company_id]);
  if (!trip) return res.json(null);

  const events = await query("SELECT * FROM trip_events WHERE trip_id = ? ORDER BY stage ASC", [trip.id]);
  res.json({ ...trip, events });
});

app.get("/api/reports", authenticate, async (req: any, res) => {
  const { startDate, endDate, driverId, vehicleNumber } = req.query;
  const company_id = req.user.company_id;
  if (!company_id) return res.json([]);

  try {
    let sql = `
      SELECT t.*, u.full_name as driver_name 
      FROM trips t 
      JOIN users u ON t.driver_id = u.id 
      WHERE t.created_at >= ? AND t.created_at <= ? AND t.company_id = ?
    `;
    const params: any[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`, company_id];

    if (driverId) {
      sql += " AND t.driver_id = ?";
      params.push(driverId);
    }
    if (vehicleNumber) {
      sql += " AND t.vehicle_number = ?";
      params.push(vehicleNumber);
    }

    const trips = await query(sql, params);
    if (!Array.isArray(trips)) return res.json([]);

    const reports = await Promise.all(trips.map(async (trip: any) => {
      const events = await query("SELECT * FROM trip_events WHERE trip_id = ? ORDER BY stage ASC", [trip.id]);
      return { ...trip, events: Array.isArray(events) ? events : [] };
    }));

    res.json(reports);
  } catch (err: any) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/vehicle-checks", authenticate, async (req: any, res) => {
  const { trip_id, vehicle_number, check_data } = req.body;
  await query(`
    INSERT INTO vehicle_checks (trip_id, driver_id, company_id, vehicle_number, check_data)
    VALUES (?, ?, ?, ?, ?)
  `, [trip_id || null, req.user.id, req.user.company_id, vehicle_number, JSON.stringify(check_data)]);
  res.json({ success: true });
});

app.get("/api/vehicle-checks", authenticate, async (req: any, res) => {
  const { startDate, endDate, driverId, vehicleNumber } = req.query;
  let sql = `
    SELECT vc.*, u.full_name as driver_name 
    FROM vehicle_checks vc
    JOIN users u ON vc.driver_id = u.id 
    WHERE vc.created_at >= ? AND vc.created_at <= ? AND vc.company_id = ?
  `;
  const params: any[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`, req.user.company_id];

  if (driverId) {
    sql += " AND vc.driver_id = ?";
    params.push(driverId);
  }
  if (vehicleNumber) {
    sql += " AND vc.vehicle_number = ?";
    params.push(vehicleNumber);
  }

  const checks = await query(sql, params);
  res.json(checks.map((c: any) => ({ ...c, check_data: JSON.parse(c.check_data) })));
});

// Public Branding
app.get("/api/branding", async (req, res) => {
  const companyCode = req.query.companyCode;
  const companyId = req.query.companyId;
  let company;
  if (companyId && !isNaN(Number(companyId))) {
    company = await queryOne("SELECT * FROM companies WHERE id = ?", [Number(companyId)]);
  } else if (companyCode) {
    company = await queryOne("SELECT * FROM companies WHERE code = ?", [companyCode]);
  } else {
    company = await queryOne("SELECT * FROM companies WHERE code = 'DEFAULT'");
    if (!company) company = await queryOne("SELECT * FROM companies LIMIT 1");
  }

  if (!company) return res.json({});

  const settings = await query("SELECT * FROM api_settings WHERE company_id = ? AND key IN ('companyName', 'companyLogo', 'companyWallpaper')", [company.id]);
  const branding = settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = JSON.parse(curr.value);
    return acc;
  }, {
    companyName: company.name,
    companyLogo: company.logo,
    companyWallpaper: company.wallpaper
  });
  res.json(branding);
});

// API Settings
app.get("/api/settings", authenticate, async (req: any, res) => {
  const company_id = req.query.company_id || req.user.company_id;
  // If user is not admin, they can only see their own company's settings
  if (req.user.role !== 'admin' && company_id != req.user.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const settings = await query("SELECT * FROM api_settings WHERE company_id = ?", [company_id]);
  res.json(settings);
});

app.post("/api/settings", authenticate, async (req: any, res) => {
  const { key, value, company_id: target_company_id } = req.body;
  const company_id = target_company_id || req.user.company_id;
  
  // If user is not admin, they can only update their own company's settings
  if (req.user.role !== 'admin' && company_id != req.user.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  if (isPostgres) {
    await query("INSERT INTO api_settings (key, value, company_id) VALUES (?, ?, ?) ON CONFLICT (key, company_id) DO UPDATE SET value = EXCLUDED.value", [key, JSON.stringify(value), company_id]);
  } else {
    await query("INSERT OR REPLACE INTO api_settings (key, value, company_id) VALUES (?, ?, ?)", [key, JSON.stringify(value), company_id]);
  }
  res.json({ success: true });
});

// Vite Integration
async function startServer() {
  // Initialize Database first
  try {
    await initDb();
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Data Retention Cleanup Task
    const runDataRetentionCleanup = async () => {
      console.log("Running data retention cleanup...");
      try {
        const companies = await query("SELECT id, retention_days FROM companies");
        for (const company of companies) {
          const days = company.retention_days;
          if (days > 0) {
            console.log(`Deleting trip data for company ${company.id} older than ${days} days...`);
            
            if (isPostgres) {
              await query(`
                DELETE FROM trip_events 
                WHERE trip_id IN (
                  SELECT id FROM trips 
                  WHERE company_id = ? AND created_at < NOW() - INTERVAL '${days} days'
                )
              `, [company.id]);
              await query(`
                DELETE FROM trips 
                WHERE company_id = ? AND created_at < NOW() - INTERVAL '${days} days'
              `, [company.id]);
            } else {
              await query(`
                DELETE FROM trip_events 
                WHERE trip_id IN (
                  SELECT id FROM trips 
                  WHERE company_id = ? AND created_at < datetime('now', '-${days} days')
                )
              `, [company.id]);
              await query(`
                DELETE FROM trips 
                WHERE company_id = ? AND created_at < datetime('now', '-${days} days')
              `, [company.id]);
            }
          }
        }
        console.log(`Cleanup complete.`);
      } catch (err) {
        console.error("Data retention cleanup failed:", err);
      }
    };

    // Run cleanup once on startup
    runDataRetentionCleanup();
    
    // Schedule cleanup every 24 hours
    setInterval(runDataRetentionCleanup, 24 * 60 * 60 * 1000);
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });
}

startServer();
