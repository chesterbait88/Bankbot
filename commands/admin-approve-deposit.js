// admin-approve-deposit.js
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
    .setName('admin-approve-deposit')
    .setDescription('Interactively approve or deny a pending deposit request (Admin only).'),
    
  async execute(interaction) {
    // Check for admin permissions.
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ 
        content: '🚨 You do not have permission.', 
        flags: 64 
      });
    }

    // Fetch pending deposit requests.
    const deposits = await bank.getPendingDeposits();
    if (!deposits.length) {
      return interaction.reply({ 
        content: 'No pending deposit requests found.', 
        flags: 64  
      });
    }

    // Build select menu options.
    const options = await Promise.all(
      deposits.map(async (deposit) => {
        // Attempt to fetch the guild member for a display name.
        let displayName = deposit.userId; // fallback to user ID
        try {
          const member = await interaction.guild.members.fetch(deposit.userId);
          if (member) displayName = member.displayName;
        } catch (e) {
          console.error(`Could not fetch member for userId ${deposit.userId}:`, e);
        }
        return {
          label: `${displayName} – ${deposit.amount} NS`,
          description: `Nation: ${deposit.nationUsername}`,
          value: deposit.id.toString() // Use deposit request ID as value
        };
      })
    );

    // Create a select menu for pending deposits.
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_deposit')
      .setPlaceholder('Select a deposit request')
      .addOptions(options);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Send the select menu as an ephemeral message.
    await interaction.reply({ 
      content: 'Please select a deposit request to process:', 
      components: [selectRow], 
      flags: 64 
    });

    // Create a collector for the select menu.
    const selectFilter = i => i.customId === 'select_deposit' && i.user.id === interaction.user.id;
    const selectCollector = interaction.channel.createMessageComponentCollector({
      filter: selectFilter,
      componentType: ComponentType.StringSelect,
      time: 30000 // 30-second window
    });

    selectCollector.on('collect', async i => {
      // Get the selected deposit request ID.
      const selectedDepositId = i.values[0];
      const selectedDeposit = deposits.find(deposit => deposit.id.toString() === selectedDepositId);
      if (!selectedDeposit) {
        return i.update({ content: 'Deposit request not found.', components: [] });
      }

      // Build confirmation buttons:
      // Approve (green), Cancel (gray), Deny (red)
      const approveButton = new ButtonBuilder()
        .setCustomId('approve_deposit')
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);
      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_deposit')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      const denyButton = new ButtonBuilder()
        .setCustomId('deny_deposit')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);
      const buttonRow = new ActionRowBuilder().addComponents(approveButton, cancelButton, denyButton);

      // Ask for confirmation.
      await i.update({ 
        content: `You selected the deposit request from <@${selectedDeposit.userId}> for **${selectedDeposit.amount} NS**. Please choose an action:`, 
        components: [buttonRow] 
      });

      // Create a collector for the confirmation buttons.
      const buttonFilter = btn => 
        ['approve_deposit', 'cancel_deposit', 'deny_deposit'].includes(btn.customId) && btn.user.id === interaction.user.id;
      const buttonCollector = i.channel.createMessageComponentCollector({
        filter: buttonFilter,
        componentType: ComponentType.Button,
        time: 15000 // 15-second window for confirmation
      });

      buttonCollector.on('collect', async btnInteraction => {
        if (btnInteraction.customId === 'approve_deposit') {
          // Fetch the depositor's display name.
          let depositorName = selectedDeposit.userId;
          try {
            const member = await interaction.guild.members.fetch(selectedDeposit.userId);
            if (member) depositorName = member.displayName;
          } catch (error) {
            console.error(`Error fetching member for userId ${selectedDeposit.userId}:`, error);
          }
          // Get the admin's information from the interaction.
          const adminId = interaction.user.id;
          const adminUsername = interaction.user.username; // Alternatively, use interaction.user.tag or fetch displayName if needed

          // Process the deposit approval by passing the admin's info.
          const success = await bank.approveDeposit(
            selectedDeposit.userId, 
            selectedDeposit.amount, 
            depositorName, 
            adminId, 
            adminUsername
          );
          if (success) {
            const newBalance = await bank.getBalance(selectedDeposit.userId);
            await btnInteraction.update({ content: `✅ Approved deposit of **${selectedDeposit.amount} NS** for <@${selectedDeposit.userId}>.`, components: [] });
            // Notify the depositor via DM.
            try {
              const targetMember = await interaction.guild.members.fetch(selectedDeposit.userId);
              await targetMember.send(`Your deposit of **${selectedDeposit.amount} NS** has been approved. Your new balance is **${newBalance} NS**.`);
            } catch (error) {
              console.error('Error sending DM:', error);
            }
          } else {
            await btnInteraction.update({ content: '🚨 Failed to approve deposit.', components: [] });
          }
        } else if (btnInteraction.customId === 'deny_deposit') {
          // Get the admin's information.
          const adminId = interaction.user.id;
          const adminUsername = interaction.user.username;
          // Process the deposit denial.
          // Updated deny branch (no duplicate logging):
const success = await bank.rejectDeposit(
  selectedDeposit.userId, 
  selectedDeposit.amount, 
  adminId, 
  adminUsername
);
if (success) {
  await btnInteraction.update({
    content: `🚫 Denied deposit of **${selectedDeposit.amount} NS** for <@${selectedDeposit.userId}>.`,
    components: []
  });
  // Notify the depositor via DM.
  try {
    const targetMember = await interaction.guild.members.fetch(selectedDeposit.userId);
    await targetMember.send(`Your deposit of **${selectedDeposit.amount} NS** has been denied.`);
  } catch (error) {
    console.error('Error sending DM:', error);
  }
} else {
  await btnInteraction.update({ content: '🚨 Failed to deny deposit.', components: [] });
}

        } else if (btnInteraction.customId === 'cancel_deposit') {
          await btnInteraction.update({ content: 'Deposit processing cancelled.', components: [] });
        }
        buttonCollector.stop();
      });

      selectCollector.stop(); // Stop the select collector after processing one selection.
    });

    selectCollector.on('end', collected => {
      // If no selection was made before timeout, update the original message.
      if (!collected.size) {
        interaction.editReply({ content: 'No deposit selected. Command timed out.', components: [] });
      }
    });
  }
};
