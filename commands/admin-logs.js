// admin-logs.js
const { SlashCommandBuilder } = require('discord.js');
// Make sure to require your database connection pool. Adjust the path as needed.
const { pool } = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-logs')
    .setDescription('View the latest admin actions (Admin only).'),

  async execute(interaction) {
    // Ensure the command is executed in a guild and by an admin.
    if (!interaction.guild || !interaction.member?.roles?.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '🚨 You do not have permission.', flags: 64 });
    }

    // Query the latest 10 admin logs.
    const [adminLogs] = await pool.execute(
      `SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 10`
    );
    if (adminLogs.length === 0) {
      return interaction.reply({ content: 'No admin logs found.', flags: 64 });
    }

    // For each log, fetch the Discord user (if possible) to display their tag.
    const logLines = await Promise.all(
      adminLogs.map(async (log) => {
        let adminUser;
        try {
          adminUser = await interaction.client.users.fetch(log.adminId);
        } catch (err) {
          adminUser = null;
        }
        const adminDisplay = adminUser ? adminUser.tag : log.adminUsername;
        return `**${log.action}** | **${adminDisplay}** | ${log.details} | ${log.timestamp}`;
      })
    );

    const logMessage = `**📜 Latest Admin Actions:**\n` + logLines.join('\n');

    // Send the log message as an ephemeral reply.
    await interaction.reply({ content: logMessage, flags: 64 });
  },
};
