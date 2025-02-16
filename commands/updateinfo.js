// updateinfo.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateinfo')
    .setDescription('Update your personal information (pirate name, real name, ship name, email, phone number).')
    .addStringOption(option =>
      option.setName('pirate_name')
        .setDescription('Your pirate name')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('real_name')
        .setDescription('Your real name')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('ship_name')
        .setDescription('Your ship name')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Your email address')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('phone_number')
        .setDescription('Your phone number')
        .setRequired(false)
    ),
    
  async execute(interaction) {
    // Retrieve the options (if provided)
    const pirateName = interaction.options.getString('pirate_name') || null;
    const realName = interaction.options.getString('real_name') || null;
    const shipName = interaction.options.getString('ship_name') || null;
    const email = interaction.options.getString('email') || null;
    const phoneNumber = interaction.options.getString('phone_number') || null;
    const userId = interaction.user.id;

    const success = await bank.updateUserInfo(userId, pirateName, realName, shipName, email, phoneNumber);
    
    if (success) {
      await interaction.reply({ content: 'Your information has been updated!', flags: 64 });
    } else {
      await interaction.reply({ content: 'There was an error updating your information. Please try again later.', flags: 64 });
    }
  }
};
