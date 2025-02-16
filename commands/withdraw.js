// withdraw.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Request a withdrawal.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of NS to withdraw')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('nation_name')
                .setDescription('Nation username to transfer funds to')
                .setRequired(true)
        ),
    async execute(interaction) {
        const nationName = interaction.options.getString('nation_name');
        const amount = interaction.options.getInteger('amount');

        // Call the bank function to place funds into escrow
        const success = await bank.placeInEscrow(interaction.user.id, nationName, amount);

        if (success) {
            await interaction.reply({
                content: `**${amount} NS** has been placed into escrow for **${nationName}**. Pending admin approval.`,
                flags: 64
            });
        } else {
            await interaction.reply({
                content: 'Withdrawal request failed. Check your balance or contact an admin.',
                flags: 64
            });
        }
    },
};
