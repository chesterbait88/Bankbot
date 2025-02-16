// repopulatedb.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repopulatedb')
        .setDescription('Repopulate the database tables while keeping essential data (Admin only).'),
    async execute(interaction) {
        if (!interaction.guild || !interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
            return interaction.reply({ content: '🚨 You do not have permission to use this command.', flags: 64 });
        }

        try {
            await bank.repopulateDatabase();
            await interaction.reply({ content: '✅ Database tables have been repopulated while keeping essential data.', flags: 64 });
        } catch (err) {
            await interaction.reply({ content: '🚨 Failed to repopulate the database. Contact an admin.', flags: 64 });
        }
    },
};
