// admin-viewdeposits.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-viewdeposits')
    .setDescription('View all pending deposit requests (Admin only).'),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '🚨 You do not have permission.', flags: 64 });
    }

    // Fetch pending deposit requests from the bank module.
    const deposits = await bank.getPendingDeposits();

    if (deposits.length === 0) {
      return interaction.reply({ content: 'No pending deposit requests found.', flags: 64 });
    }

    // Map over each deposit to build a formatted string.
    const depositEntries = await Promise.all(
      deposits.map(async (deposit) => {
        let displayName = deposit.userId; // Fallback to user ID if display name cannot be fetched.
        if (interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(deposit.userId);
            if (member) {
              displayName = member.displayName;
            }
          } catch (error) {
            console.error(`Could not fetch member for userId ${deposit.userId}:`, error);
          }
        }
        return `**User:** ${displayName} | **Facebook Nation Name:** ${deposit.nationUsername} | **Amount:** ${deposit.amount} NS | **Receipt:** ${deposit.receiptUrl}`;
      })
    );

    const replyMessage = `**📥 Pending Deposit Requests:**\n\n${depositEntries.join('\n')}`;
    await interaction.reply({ content: replyMessage, flags: 64 });
  },
};
