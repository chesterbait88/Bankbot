// ministatement.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ministatement')
    .setDescription('View your last 5 transactions.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const transactions = await bank.getTransactionsByUser(userId, 5);
    if (!transactions || transactions.length === 0) {
      return interaction.reply({ content: 'No transactions found.', flags: 64 });
    }
    let message = '**Your Last 5 Transactions:**\n';
    transactions.forEach(tx => {
      // Format each transaction entry. Adjust the output as needed.
      message += `**${tx.type}**: ${tx.amount} NS, From: ${tx.fromUsername || 'N/A'}, To: ${tx.toUsername || 'N/A'}, on ${new Date(tx.timestamp).toLocaleString()}\n`;
    });
    await interaction.reply({ content: message, flags: 64 });
  },
};
