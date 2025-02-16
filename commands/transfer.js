// transfer.js
const { 
  SlashCommandBuilder, 
  ButtonBuilder, 
  ActionRowBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');
const bank = require('../bank.js');

// In-memory cooldown map for the transfer command
const transferCooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Send NS to another user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The recipient')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of NS to transfer')
        .setRequired(true)
    ),

  async execute(interaction) {
    // RATE LIMITING: Check if the user is on cooldown.
    const cooldownKey = `transfer_${interaction.user.id}`;
    const now = Date.now();
    const cooldownDuration = 10 * 1000; // 10-second cooldown (adjust as needed)
    if (transferCooldowns.has(cooldownKey)) {
      const expirationTime = transferCooldowns.get(cooldownKey);
      if (now < expirationTime) {
        const timeLeft = Math.ceil((expirationTime - now) / 1000);
        return interaction.reply({ content: `Please wait ${timeLeft} more second(s) before using /transfer again.`, flags: 64 });
      }
    }
    transferCooldowns.set(cooldownKey, now + cooldownDuration);

    // Retrieve command options.
    const sender = interaction.user;
    const recipient = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    // Validate that the recipient is valid and not the sender.
    if (!recipient || recipient.id === sender.id) {
      return interaction.reply({ content: 'Invalid recipient.', flags: 64 });
    }

    // Build confirmation buttons.
    const yesButton = new ButtonBuilder()
      .setCustomId('confirm_transfer_yes')
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success);
    const noButton = new ButtonBuilder()
      .setCustomId('confirm_transfer_no')
      .setLabel('No')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(yesButton, noButton);

    // Ask the sender for confirmation.
    await interaction.reply({ 
      content: `Are you sure you want to transfer **${amount} NS** to **${recipient.username}**?`, 
      components: [row], 
      flags: 64 
    });

    // Create a collector to await the sender’s confirmation.
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000, // 15-second window for confirmation.
      filter: i => i.user.id === sender.id
    });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_transfer_yes') {
        // Process the transfer.
        const success = await bank.transferFunds(sender.id, sender.username, recipient.id, recipient.username, amount);
        if (success) {
          await i.update({ content: `✅ Transfer of **${amount} NS** to **${recipient.username}** confirmed.`, components: [] });
          // Notify both users via DM.
          try {
            await sender.send(`You have successfully transferred **${amount} NS** to **${recipient.username}**.`);
          } catch (error) {
            console.error('Error sending DM to sender:', error);
          }
          try {
            await recipient.send(`You have received **${amount} NS** from **${sender.username}**.`);
          } catch (error) {
            console.error('Error sending DM to recipient:', error);
          }
        } else {
          await i.update({ content: '🚨 Transfer failed. Please check your balance or try again later.', components: [] });
        }
        collector.stop();
      } else if (i.customId === 'confirm_transfer_no') {
        await i.update({ content: 'Transfer cancelled.', components: [] });
        collector.stop();
      }
    });

    collector.on('end', collected => {
      if (!collected.size) {
        interaction.editReply({ content: 'Transfer timed out.', components: [] });
      }
    });
  }
};
