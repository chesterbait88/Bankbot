// bank.js
require('dotenv').config();

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// =============================================================================
// Database Connection
// =============================================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// =============================================================================
// Transaction Logging Functions
// =============================================================================

/**
 * Logs a transaction in the transactions table.
 *
 * @param {string} type - The transaction type.
 * @param {string} fromUserId - The user ID initiating the transaction.
 * @param {string} fromUsername - The username of the initiating user.
 * @param {string} toUserId - The target user ID.
 * @param {string} toUsername - The target username.
 * @param {number} amount - The transaction amount.
 * @returns {Promise<boolean>}
 */
async function logTransaction(type, fromUserId, fromUsername, toUserId, toUsername, amount) {
  try {
    await pool.execute(
      `INSERT INTO transactions (id, type, fromUserId, fromUsername, toUserId, toUsername, amount, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), type, fromUserId, fromUsername, toUserId, toUsername, amount]
    );
    return true;
  } catch (err) {
    console.error('Error logging transaction:', err);
    return false;
  }
}

/**
 * Logs an admin action in the admin_logs table.
 *
 * @param {string} adminId - The admin's ID.
 * @param {string} adminUsername - The admin's username.
 * @param {string} action - The action performed.
 * @param {string} details - Additional details about the action.
 */
async function logAdminAction(adminId, adminUsername, action, details) {
  try {
    await pool.execute(
      `INSERT INTO admin_logs (adminId, adminUsername, action, details)
       VALUES (?, ?, ?, ?)`,
      [adminId, adminUsername, action, details]
    );
  } catch (err) {
    console.error('❌ Error logging admin action:', err);
  }
}

// =============================================================================
// Transaction Retrieval Functions
// =============================================================================

/**
 * Fetch the latest transactions.
 *
 * @param {number} [limit=10] - Maximum number of transactions to return.
 * @returns {Promise<Array>}
 */
async function getTransactions(limit = 10) {
  try {
    const safeLimit = parseInt(limit, 10);
    if (isNaN(safeLimit) || safeLimit <= 0) {
      throw new Error('Invalid limit value for transactions.');
    }

    // MySQL does not allow parameter binding for LIMIT so we interpolate safely.
    const [rows] = await pool.execute(
      `SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ${safeLimit}`
    );
    return rows;
  } catch (err) {
    console.error('❌ Error fetching transactions:', err);
    return [];
  }
}

/**
 * Get transaction logs with a specified limit.
 *
 * @param {number} [limit=10] - Maximum number of logs to return.
 * @returns {Promise<Array>}
 */
async function getTransactionLogs(limit = 10) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error('Error fetching transaction logs:', err);
    return [];
  }
}

/**
 * Get the latest transactions for a specific user (as sender or recipient).
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} [limit=5] - Number of transactions to retrieve.
 * @returns {Promise<Array>}
 */
async function getTransactionsByUser(userId, limit = 5) {
  try {
    const safeLimit = parseInt(limit, 10);
    const query = `
      SELECT * FROM transactions
      WHERE fromUserId = ? OR toUserId = ?
      ORDER BY timestamp DESC
      LIMIT ${safeLimit}
    `;
    const [rows] = await pool.execute(query, [userId, userId]);
    return rows;
  } catch (err) {
    console.error('Error fetching transactions for user:', err);
    return [];
  }
}

// =============================================================================
// Deposit & Withdrawal Functions
// =============================================================================

/**
 * Request a deposit.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} discordUsername - The Discord username.
 * @param {string} nationUsername - The username linked to the Nation's bank account.
 * @param {number} amount - The deposit amount.
 * @param {string} receiptUrl - URL of the transaction receipt.
 * @returns {Promise<boolean>}
 */
async function requestDeposit(userId, discordUsername, nationUsername, amount, receiptUrl) {
  try {
    await pool.execute(
      `INSERT INTO deposit_requests (userId, discordUsername, nationUsername, amount, receiptUrl, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, discordUsername, nationUsername, amount, receiptUrl]
    );
    return true;
  } catch (err) {
    console.error('Error requesting deposit:', err);
    return false;
  }
}

// =============================================================================
// Approve Deposit
// =============================================================================
async function approveDeposit(userId, amount, username, adminId, adminUsername) {
  try {
    if (username === undefined) username = null;
    if (adminId === undefined) adminId = null;
    if (adminUsername === undefined) adminUsername = null;

    // Ensure the user has an entry in the balances table.
    await pool.execute(
      `INSERT INTO balances (userId, username, balance)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE username = VALUES(username)`,
      [userId, username]
    );

    // Add funds to the user's balance.
    await addBalance(userId, username, amount);

    // Mark the deposit request as approved.
    const [result] = await pool.execute(
      `UPDATE deposit_requests SET status = 'approved' WHERE userId = ? AND amount = ? AND status = 'pending'`,
      [userId, amount]
    );

    if (result.affectedRows === 0) {
      console.warn(
        `⚠️ No matching pending deposit request found for user ${userId} and amount ${amount}`
      );
      return false;
    }

    // Log the deposit approval in the transactions table.
    await logTransaction('admin_approve', adminId, adminUsername, userId, username, amount);

    // Also log the admin action in the admin_logs table.
    await logAdminAction(
      adminId,
      adminUsername,
      'approve_deposit',
      `Approved deposit of ${amount} NS for user ${userId} (${username}).`
    );

    return true;
  } catch (err) {
    console.error('❌ Error approving deposit:', err);
    return false;
  }
}

// =============================================================================
// Reject Deposit
// =============================================================================
async function rejectDeposit(userId, amount, adminId, adminUsername) {
  try {
    await pool.execute(
      `UPDATE deposit_requests SET status = 'rejected' WHERE userId = ? AND amount = ? AND status = 'pending'`,
      [userId, amount]
    );

    // Log the deposit rejection in the transactions table.
    await logTransaction('admin_reject', adminId, adminUsername, userId, null, amount);

    // Also log the admin action in the admin_logs table.
    await logAdminAction(
      adminId,
      adminUsername,
      'reject_deposit',
      `Rejected deposit of ${amount} NS for user ${userId}.`
    );

    return true;
  } catch (err) {
    console.error('Error rejecting deposit:', err);
    return false;
  }
}


/**
 * Retrieve all pending deposit requests.
 *
 * @returns {Promise<Array>}
 */
async function getPendingDeposits() {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM deposit_requests WHERE status = 'pending' ORDER BY timestamp DESC`
    );
    return rows;
  } catch (err) {
    console.error('❌ Error fetching pending deposit requests:', err);
    return [];
  }
}

/**
 * Retrieve all pending withdrawal requests from the escrow table.
 *
 * @returns {Promise<Array>}
 */
async function getPendingWithdrawals() {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM escrow WHERE status = 'pending'`
    );
    return rows;
  } catch (err) {
    console.error('Error fetching pending withdrawals:', err);
    return [];
  }
}

/**
 * Approve a pending withdrawal request.
 *
 * @param {string} userId - The Discord user ID of the requester.
 * @param {number} amount - The withdrawal amount to approve.
 * @returns {Promise<boolean>}
 */
async function approveWithdrawal(userId, amount) {
  try {
    const [result] = await pool.execute(
      `UPDATE escrow SET status = 'approved' WHERE userId = ? AND amount = ? AND status = 'pending'`,
      [userId, amount]
    );
    if (result.affectedRows === 0) {
      return false;
    }
    await logTransaction('admin_withdrawal_approve', 'ADMIN', 'Admin', userId, '', amount);
    return true;
  } catch (err) {
    console.error('Error approving withdrawal:', err);
    return false;
  }
}

/**
 * Reject a pending withdrawal request.
 *
 * @param {string} userId - The Discord user ID of the requester.
 * @param {number} amount - The withdrawal amount to reject.
 * @returns {Promise<boolean>}
 */
async function rejectWithdrawal(userId, amount) {
  try {
    const [result] = await pool.execute(
      `UPDATE escrow SET status = 'rejected' WHERE userId = ? AND amount = ? AND status = 'pending'`,
      [userId, amount]
    );
    if (result.affectedRows === 0) {
      return false;
    }
    await logTransaction('admin_withdrawal_reject', 'ADMIN', 'Admin', userId, '', amount);
    return true;
  } catch (err) {
    console.error('Error rejecting withdrawal:', err);
    return false;
  }
}

// =============================================================================
// Balance Management Functions
// =============================================================================

/**
 * Sets the balance for a user.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} username - The user's username.
 * @param {number} amount - The balance amount to set.
 * @returns {Promise<boolean>}
 */
async function setBalance(userId, username, amount) {
  try {
    await pool.execute(
      `INSERT INTO balances (userId, username, balance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
      [userId, username, amount]
    );
    // Log the balance update (note: adminUsername was removed to match logTransaction parameters)
    await logTransaction('admin_setbalance', 'SYSTEM', username, userId, username, amount);
    return true;
  } catch (err) {
    console.error('❌ Error setting balance:', err);
    return false;
  }
}

/**
 * Get the current balance for a user.
 *
 * @param {string} userId - The Discord user ID.
 * @returns {Promise<number>}
 */
async function getBalance(userId) {
  try {
    const [rows] = await pool.execute('SELECT balance FROM balances WHERE userId = ?', [userId]);
    return rows.length > 0 ? parseFloat(rows[0].balance) : 0;
  } catch (err) {
    console.error('❌ Error fetching balance:', err);
    throw err;
  }
}

/**
 * Add a specified amount to a user's balance.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} username - The user's username.
 * @param {number} amount - The amount to add.
 * @returns {Promise<boolean>}
 */
async function addBalance(userId, username, amount) {
  try {
    if (username === undefined) username = null;
    await pool.execute(
      `INSERT INTO balances (userId, username, balance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance), username = VALUES(username)`,
      [userId, username, amount]
    );
    await logTransaction('deposit', 'SYSTEM', 'Admin', userId, username, amount);
    return true;
  } catch (err) {
    console.error('Error adding balance:', err);
    return false;
  }
}

/**
 * Subtract a specified amount from a user's balance safely.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} username - The user's username.
 * @param {number} amount - The amount to subtract.
 * @returns {Promise<boolean>}
 */
async function subtractBalance(userId, username, amount) {
  if (amount <= 0) {
    console.warn('⚠️ Invalid subtraction attempt.');
    return false;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT balance FROM balances WHERE userId = ? FOR UPDATE',
      [userId]
    );
    const currentBalance = rows.length > 0 ? parseFloat(rows[0].balance) : 0;

    if (currentBalance < amount) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      `UPDATE balances SET balance = balance - ? WHERE userId = ?`,
      [amount, userId]
    );

    await logTransaction('withdrawal', userId, username, 'SYSTEM', 'Bank', amount);
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error subtracting balance:', err);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Transfer funds securely between two users.
 *
 * @param {string} fromUserId - Sender's Discord user ID.
 * @param {string} fromUsername - Sender's username.
 * @param {string} toUserId - Recipient's Discord user ID.
 * @param {string} toUsername - Recipient's username.
 * @param {number} amount - The amount to transfer.
 * @returns {Promise<boolean>}
 */
async function transferFunds(fromUserId, fromUsername, toUserId, toUsername, amount) {
  if (amount <= 0 || fromUserId === toUserId) {
    console.warn('⚠️ Invalid transfer parameters.');
    return false;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT balance FROM balances WHERE userId = ? FOR UPDATE',
      [fromUserId]
    );
    const senderBalance = rows.length > 0 ? parseFloat(rows[0].balance) : 0;

    if (senderBalance < amount) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      'UPDATE balances SET balance = balance - ? WHERE userId = ?',
      [amount, fromUserId]
    );
    await connection.execute(
      `INSERT INTO balances (userId, username, balance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
      [toUserId, toUsername, amount]
    );

    await logTransaction('transfer', fromUserId, fromUsername, toUserId, toUsername, amount);
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error transferring funds:', err);
    return false;
  } finally {
    connection.release();
  }
}

// =============================================================================
// Escrow Functions
// =============================================================================

/**
 * Place funds in escrow.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} nationName - The name of the nation.
 * @param {number} amount - The amount to place in escrow.
 * @returns {Promise<boolean>}
 */
async function placeInEscrow(userId, nationName, amount) {
  try {
    const [rows] = await pool.execute('SELECT balance FROM balances WHERE userId = ?', [userId]);
    const balance = rows.length > 0 ? parseFloat(rows[0].balance) : 0;
    if (balance < amount) {
      return false;
    }

    // Deduct the amount from the user's main balance.
    await pool.execute('UPDATE balances SET balance = balance - ? WHERE userId = ?', [amount, userId]);

    // Insert or update the escrow record.
    await pool.execute(
      `INSERT INTO escrow (userId, amount, nationName)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount), nationName = VALUES(nationName)`,
      [userId, amount, nationName]
    );

    return true;
  } catch (err) {
    console.error('Error placing in escrow:', err);
    return false;
  }
}

/**
 * Release escrowed funds back to a user's main balance.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} amount - The amount to release.
 * @returns {Promise<boolean>}
 */
async function releaseEscrow(userId, amount) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT amount FROM escrow WHERE userId = ? FOR UPDATE',
      [userId]
    );
    const escrowBalance = rows.length > 0 ? parseFloat(rows[0].amount) : 0;

    if (escrowBalance < amount) {
      await connection.rollback();
      return false;
    }

    // Deduct from escrow.
    await connection.execute(
      'UPDATE escrow SET amount = amount - ? WHERE userId = ?',
      [amount, userId]
    );

    // Add to user's main balance.
    await connection.execute(
      'UPDATE balances SET balance = balance + ? WHERE userId = ?',
      [amount, userId]
    );

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    console.error('Error in releaseEscrow:', err);
    return false;
  } finally {
    connection.release();
  }
}

// =============================================================================
// Ledger & Master Account Functions
// =============================================================================

/**
 * Verify ledger consistency by comparing approved deposits, withdrawals, and balances.
 *
 * @returns {Promise<boolean>}
 */
async function verifyLedger() {
  try {
    // Sum of approved deposits from deposit_requests.
    const [[{ totalApprovedDeposits }]] = await pool.execute(
      `SELECT IFNULL(SUM(amount), 0) AS totalApprovedDeposits
       FROM deposit_requests
       WHERE status = 'approved'`
    );

    // Sum of approved withdrawals from escrow.
    const [[{ totalApprovedWithdrawals }]] = await pool.execute(
      `SELECT IFNULL(SUM(amount), 0) AS totalApprovedWithdrawals
       FROM escrow
       WHERE status = 'approved'`
    );

    // Sum of all user balances.
    const [[{ totalBalances }]] = await pool.execute(
      `SELECT IFNULL(SUM(balance), 0) AS totalBalances FROM balances`
    );

    const deposits = parseFloat(totalApprovedDeposits);
    const withdrawals = parseFloat(totalApprovedWithdrawals);
    const balances = parseFloat(totalBalances);
    const calculatedHoldings = deposits - withdrawals;

    if (calculatedHoldings !== balances) {
      throw new Error(`Ledger mismatch! Approved Deposits - Approved Withdrawals (${calculatedHoldings}) does not equal total balances (${balances})`);
    }
    return true;
  } catch (err) {
    console.error('Ledger verification failed:', err);
    return false;
  }
}

/**
 * Get the master account balance calculated as approved deposits minus approved withdrawals.
 *
 * @returns {Promise<number>}
 */
async function getMasterAccountBalance() {
  try {
    const [[{ totalApprovedDeposits }]] = await pool.execute(
      `SELECT IFNULL(SUM(amount), 0) AS totalApprovedDeposits 
       FROM deposit_requests 
       WHERE status = 'approved'`
    );
    const [[{ totalApprovedWithdrawals }]] = await pool.execute(
      `SELECT IFNULL(SUM(amount), 0) AS totalApprovedWithdrawals 
       FROM escrow 
       WHERE status = 'approved'`
    );

    const deposits = parseFloat(totalApprovedDeposits) || 0;
    const withdrawals = parseFloat(totalApprovedWithdrawals) || 0;
    return deposits - withdrawals;
  } catch (err) {
    console.error('❌ Error calculating master account balance:', err);
    return 0;
  }
}

// =============================================================================
// User Information Functions
// =============================================================================

/**
 * Updates a user's additional information in the balances table.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string|null} pirateName - The user's pirate name.
 * @param {string|null} realName - The user's real name.
 * @param {string|null} shipName - The user's ship name.
 * @param {string|null} email - The user's email address.
 * @param {string|null} phoneNumber - The user's phone number.
 * @returns {Promise<boolean>}
 */
async function updateUserInfo(userId, pirateName, realName, shipName, email, phoneNumber) {
  try {
    await pool.execute(
      `INSERT INTO balances (userId, pirateName, realName, shipName, email, phoneNumber)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pirateName = VALUES(pirateName),
         realName = VALUES(realName),
         shipName = VALUES(shipName),
         email = VALUES(email),
         phoneNumber = VALUES(phoneNumber)`,
      [userId, pirateName, realName, shipName, email, phoneNumber]
    );
    return true;
  } catch (err) {
    console.error('Error updating user info:', err);
    return false;
  }
}

/**
 * Retrieves user information from the balances table and pulls the nation username
 * from the most recent approved deposit request.
 *
 * @param {string} userId - The Discord user ID.
 * @returns {Promise<Object|null>} An object containing user info or null if not found.
 */
async function lookupUserInfo(userId) {
  try {
    // Query the balances table for basic user info.
    const [balanceRows] = await pool.execute(
      'SELECT userId, username, balance, pirateName, realName, shipName, email, phoneNumber FROM balances WHERE userId = ?',
      [userId]
    );
    if (balanceRows.length === 0) {
      return null;
    }
    const info = balanceRows[0];

    // Query the deposit_requests table for the most recent approved deposit for this user.
    const [depositRows] = await pool.execute(
      `SELECT nationUsername FROM deposit_requests WHERE userId = ? AND status = 'approved' ORDER BY timestamp DESC LIMIT 1`,
      [userId]
    );
    if (depositRows.length > 0) {
      info.nationUsername = depositRows[0].nationUsername;
    } else {
      info.nationUsername = 'Not set';
    }

    // Provide default values for any additional fields if they are missing.
    info.pirateName = info.pirateName || 'Not set';
    info.realName = info.realName || 'Not set';
    info.shipName = info.shipName || 'Not set';
    info.email = info.email || 'Not set';
    info.phoneNumber = info.phoneNumber || 'Not set';

    return info;
  } catch (err) {
    console.error('Error looking up user info:', err);
    return null;
  }
}


// =============================================================================
// Database Setup / Re-population
// =============================================================================

/**
 * Repopulate the database by creating necessary tables if they don't exist.
 *
 * @returns {Promise<boolean>}
 */
async function repopulateDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Create the balances table with additional columns.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS balances (
        userId VARCHAR(50) NOT NULL,
        username VARCHAR(100) DEFAULT NULL,
        balance DECIMAL(18,2) NOT NULL DEFAULT '0.00',
        pirateName VARCHAR(100) DEFAULT NULL,
        realName VARCHAR(100) DEFAULT NULL,
        shipName VARCHAR(100) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        phoneNumber VARCHAR(50) DEFAULT NULL,
        PRIMARY KEY (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Create the transactions table.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(50) NOT NULL,
        type ENUM('deposit','withdrawal','transfer','admin_setbalance','admin_approve','admin_withdrawal_approve','admin_withdrawal_reject') NOT NULL,
        fromUserId VARCHAR(50) DEFAULT NULL,
        fromUsername VARCHAR(100) DEFAULT NULL,
        toUserId VARCHAR(50) DEFAULT NULL,
        toUsername VARCHAR(100) DEFAULT NULL,
        amount DECIMAL(20,2) DEFAULT NULL,
        timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        performedBy VARCHAR(100) DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Create the deposit_requests table.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id INT NOT NULL AUTO_INCREMENT,
        userId VARCHAR(50) DEFAULT NULL,
		discordUsername VARCHAR(100) DEFAULT NULL,
        nationUsername VARCHAR(100) DEFAULT NULL,
        amount DECIMAL(20,2) DEFAULT NULL,
        receiptUrl TEXT,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Create the escrow table.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS escrow (
        id INT NOT NULL AUTO_INCREMENT,
        userId VARCHAR(50) NOT NULL,
        amount DECIMAL(20,2) DEFAULT '0.00',
        nationName VARCHAR(100) DEFAULT '',
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Create the admin_logs table.
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INT NOT NULL AUTO_INCREMENT,
        adminId VARCHAR(50) DEFAULT NULL,
        adminUsername VARCHAR(100) DEFAULT NULL,
        action VARCHAR(255) DEFAULT NULL,
        details TEXT,
        timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    console.error('Error repopulating database:', err);
    return false;
  } finally {
    connection.release();
  }
}

// =============================================================================
// Module Exports
// =============================================================================

module.exports = {
  pool,
  // Transaction logging & retrieval
  logTransaction,
  logAdminAction,
  getTransactions,
  getTransactionLogs,
  getTransactionsByUser,

  // Deposit & withdrawal operations
  requestDeposit,
  approveDeposit,
  rejectDeposit,
  getPendingDeposits,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,

  // Balance management
  setBalance,
  getBalance,
  addBalance,
  subtractBalance,
  transferFunds,

  // Escrow operations
  placeInEscrow,
  releaseEscrow,

  // Ledger & master account functions
  verifyLedger,
  getMasterAccountBalance,

  // User information functions
  updateUserInfo,
  lookupUserInfo,

  // Database setup
  repopulateDatabase,
};
