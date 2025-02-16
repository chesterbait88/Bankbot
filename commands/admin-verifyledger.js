// admin-verifyledger.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-verifyledger')
    .setDescription('Manually verify ledger balance.'),
    
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ 
        content: 'You do not have permission.', 
         flags: 64  
      });
    }

    // Verify that the ledger is balanced.
    const isLedgerValid = await bank.verifyLedger();
    // Retrieve the total ledger amount (master account balance).
    const total = await bank.getMasterAccountBalance();

    if (isLedgerValid) {
      await interaction.reply({ 
        content: `✅ Ledger is balanced and correct.\nTotal: **${total} NS**`, 
         flags: 64 
      });
    } else {
      await interaction.reply({ 
        content: `🚨 Ledger mismatch detected! Immediate admin action required.\nTotal: **${total} NS**`, 
         flags: 64 
      });
    }
  },
};
