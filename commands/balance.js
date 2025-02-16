// balance.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

// In-memory cooldown map for the balance command.
const balanceCooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your balance.'),
  async execute(interaction) {
    const cooldownKey = `balance_${interaction.user.id}`;
    const now = Date.now();
    const cooldownDuration = 30 * 1000; // 30-second cooldown
    if (balanceCooldowns.has(cooldownKey)) {
      const expirationTime = balanceCooldowns.get(cooldownKey);
      if (now < expirationTime) {
        const timeLeft = Math.ceil((expirationTime - now) / 1000);
        return interaction.reply({ content: `Please wait ${timeLeft} more second(s) before checking your balance again.`, flags: 64 });
      }
    }
    balanceCooldowns.set(cooldownKey, now + cooldownDuration);

    const balance = await bank.getBalance(interaction.user.id);
    let message = `Your balance: **${balance} NS**`;
    if (balance === 0) {
      message += `\n\nYour balance is zero. Please consider making a deposit request using \`/deposit\` or ask someone to transfer NS to you using \`/transfer\`.`;
    }
    await interaction.reply({ content: message, flags: 64 });
  }
};
