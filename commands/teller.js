// teller.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('teller')
    .setDescription('Post the teller message with interactive buttons.'),
  async execute(interaction) {
    // Create buttons for each functionality
    const balanceButton = new ButtonBuilder()
      .setCustomId('teller_balance')
      .setLabel('Check Balance')
      .setStyle(ButtonStyle.Primary);

    const transferButton = new ButtonBuilder()
      .setCustomId('teller_transfer')
      .setLabel('Transfer NS')
      .setStyle(ButtonStyle.Primary);

    const statementButton = new ButtonBuilder()
      .setCustomId('teller_statement')
      .setLabel('View Transactions')
      .setStyle(ButtonStyle.Primary);

    const withdrawButton = new ButtonBuilder()
      .setCustomId('teller_withdraw')
      .setLabel('Withdraw NS')
      .setStyle(ButtonStyle.Primary);

    const depositButton = new ButtonBuilder()
      .setCustomId('teller_deposit')
      .setLabel('Deposit NS')
      .setStyle(ButtonStyle.Primary);

    // Arrange the buttons in one or two rows
    const row1 = new ActionRowBuilder().addComponents(balanceButton, transferButton, statementButton);
    const row2 = new ActionRowBuilder().addComponents(withdrawButton, depositButton);

    // Build an embed for the teller message
    const embed = new EmbedBuilder()
      .setTitle('Teller Services')
      .setDescription('Click a button below to use a service.')
      .setColor(0x00AE86);

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },
};
