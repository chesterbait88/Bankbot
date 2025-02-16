// admin-approve-withdrawal.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-approve-withdrawal')
    .setDescription('Interactively process a pending withdrawal request (Admin only).'),
    
  async execute(interaction) {
    // Ensure the command is executed by an admin.
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '🚨 You do not have permission.',  flags: 64 });
    }

    // Retrieve pending withdrawal requests.
    const withdrawals = await bank.getPendingWithdrawals(); // Must return an array with fields: id, userId, amount, nationName, etc.
    if (!withdrawals.length) {
      return interaction.reply({ content: 'No pending withdrawal requests found.',  flags: 64 });
    }

    // Filter out any withdrawals that don't have an id.
    const validWithdrawals = withdrawals.filter(w => w.id !== undefined && w.id !== null);
    if (!validWithdrawals.length) {
      return interaction.reply({ content: 'No valid pending withdrawal requests found.',  flags: 64  });
    }

    // Build select menu options.
    const options = await Promise.all(
      validWithdrawals.map(async (withdrawal) => {
        // Attempt to fetch the guild member to display their nickname.
        let displayName = withdrawal.userId; // Fallback to user ID.
        try {
          const member = await interaction.guild.members.fetch(withdrawal.userId);
          if (member) displayName = member.displayName;
        } catch (e) {
          console.error(`Could not fetch member for userId ${withdrawal.userId}:`, e);
        }
        return {
          label: `${displayName} – ${withdrawal.amount} NS`,
          description: `Nation: ${withdrawal.nationName}`,
          value: withdrawal.id.toString() // Use withdrawal request ID as value.
        };
      })
    );

    // Create the select menu.
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_withdrawal')
      .setPlaceholder('Select a withdrawal request to process')
      .addOptions(options);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Send the select menu as an ephemeral message.
    await interaction.reply({ 
      content: 'Please select a pending withdrawal request to process:', 
      components: [selectRow], 
      ephemeral: true 
    });

    // Create a collector to handle the selection.
    const selectFilter = i => i.customId === 'select_withdrawal' && i.user.id === interaction.user.id;
    const selectCollector = interaction.channel.createMessageComponentCollector({
      filter: selectFilter,
      componentType: ComponentType.StringSelect,
      time: 30000 // 30-second window.
    });

    selectCollector.on('collect', async i => {
      const selectedWithdrawalId = i.values[0];
      const selectedWithdrawal = validWithdrawals.find(w => w.id.toString() === selectedWithdrawalId);
      if (!selectedWithdrawal) {
        return i.update({ content: 'Withdrawal request not found.', components: [] });
      }

      // Build confirmation buttons: Approve, Cancel, and Deny.
      const approveButton = new ButtonBuilder()
        .setCustomId('approve_withdrawal')
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);
      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_withdrawal')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      const denyButton = new ButtonBuilder()
        .setCustomId('deny_withdrawal')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);
      const buttonRow = new ActionRowBuilder().addComponents(approveButton, cancelButton, denyButton);

      // Ask for confirmation.
      await i.update({
        content: `You selected the withdrawal request from <@${selectedWithdrawal.userId}> for **${selectedWithdrawal.amount} NS** (Nation: ${selectedWithdrawal.nationName}). Please choose an action:`,
        components: [buttonRow]
      });

      // Create a collector for the confirmation buttons.
      const buttonFilter = btn =>
        ['approve_withdrawal', 'cancel_withdrawal', 'deny_withdrawal'].includes(btn.customId) &&
        btn.user.id === interaction.user.id;
      const buttonCollector = i.channel.createMessageComponentCollector({
        filter: buttonFilter,
        componentType: ComponentType.Button,
        time: 15000 // 15-second window for confirmation.
      });

      buttonCollector.on('collect', async btnInteraction => {
        if (btnInteraction.customId === 'approve_withdrawal') {
          // Approve the withdrawal.
          const success = await bank.approveWithdrawal(selectedWithdrawal.userId, selectedWithdrawal.amount);
          if (success) {
            await bank.logAdminAction(
              interaction.user.id,
              interaction.user.username,
              'approve_withdrawal',
              `Approved withdrawal of ${selectedWithdrawal.amount} NS for user ${selectedWithdrawal.userId}.`
            );
            await btnInteraction.update({ 
              content: `✅ Approved withdrawal of **${selectedWithdrawal.amount} NS** for <@${selectedWithdrawal.userId}>.`, 
              components: [] 
            });
            // Notify the user via DM.
            try {
              const member = await interaction.guild.members.fetch(selectedWithdrawal.userId);
              await member.send(`Your withdrawal request of **${selectedWithdrawal.amount} NS** has been approved.`);
            } catch (error) {
              console.error('Error sending DM to user:', error);
            }
          } else {
            await btnInteraction.update({ content: '🚨 Failed to approve withdrawal.', components: [] });
          }
        } else if (btnInteraction.customId === 'deny_withdrawal') {
          // Deny the withdrawal.
          const success = await bank.rejectWithdrawal(selectedWithdrawal.userId, selectedWithdrawal.amount);
          if (success) {
            await bank.logAdminAction(
              interaction.user.id,
              interaction.user.username,
              'deny_withdrawal',
              `Denied withdrawal of ${selectedWithdrawal.amount} NS for user ${selectedWithdrawal.userId}.`
            );
            await btnInteraction.update({ 
              content: `🚫 Denied withdrawal of **${selectedWithdrawal.amount} NS** for <@${selectedWithdrawal.userId}>.`, 
              components: [] 
            });
            // Notify the user via DM.
            try {
              const member = await interaction.guild.members.fetch(selectedWithdrawal.userId);
              await member.send(`Your withdrawal request of **${selectedWithdrawal.amount} NS** has been denied.`);
            } catch (error) {
              console.error('Error sending DM to user:', error);
            }
          } else {
            await btnInteraction.update({ content: '🚨 Failed to deny withdrawal.', components: [] });
          }
        } else if (btnInteraction.customId === 'cancel_withdrawal') {
          await btnInteraction.update({ content: 'Withdrawal processing cancelled.', components: [] });
        }
        buttonCollector.stop();
      });
      selectCollector.stop(); // Stop after processing one selection.
    });

    selectCollector.on('end', collected => {
      if (!collected.size) {
        interaction.editReply({ content: 'No withdrawal selected. Command timed out.', components: [] });
      }
    });
  }
};
