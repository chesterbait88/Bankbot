// admin-viewwithdrawals.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-viewwithdrawals')
    .setDescription('View all pending withdrawal requests (Admin only).'),
    
  async execute(interaction) {
    // Check for admin permissions.
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '🚨 You do not have permission.', flags: 64 });
    }

    // Retrieve all pending withdrawal requests from the escrow table.
    const withdrawals = await bank.getPendingWithdrawals();
    if (!withdrawals.length) {
      return interaction.reply({ content: 'No pending withdrawal requests found.', flags: 64 });
    }

    // Build a list of withdrawal entries.
    const withdrawalEntries = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        // Attempt to fetch the member for a friendly display name.
        let displayName = withdrawal.userId; // Fallback to userId if member fetch fails.
        try {
          const member = await interaction.guild.members.fetch(withdrawal.userId);
          if (member) displayName = member.displayName;
        } catch (error) {
          console.error(`Error fetching member for userId ${withdrawal.userId}:`, error);
        }
        // Build a string for this withdrawal entry.
        return `**User:** ${displayName} | **Amount:** ${withdrawal.amount} NS | **Nation:** ${withdrawal.nationName}`;
      })
    );

    // Create the final reply message.
    const replyMessage = `**Pending Withdrawal Requests:**\n\n${withdrawalEntries.join('\n')}`;
    
    // Send the reply as an ephemeral message (using flags: 64 for Discord.js v14).
    await interaction.reply({ content: replyMessage, flags: 64 });
  }
};
