const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/imageonly.json');

// Load existing settings or create an empty object if the file doesn't exist
let imageOnlyChannels = {};
try {
  if (fs.existsSync(FILE_PATH)) {
    const data = fs.readFileSync(FILE_PATH, 'utf8');
    imageOnlyChannels = JSON.parse(data);
  }
} catch (err) {
  console.error(`❌ Error loading image-only settings:`, err);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imageonly')
    .setDescription('Toggles attachments-only mode in the current channel'),
  
  async execute(interaction) {
    try {
      await interaction.deferReply({  flags: 64  }); // Prevents Discord timeout

      const channelId = interaction.channel.id;
      if (imageOnlyChannels[channelId]) {
        delete imageOnlyChannels[channelId];
      } else {
        imageOnlyChannels[channelId] = true;
      }

      // Attempt to save settings
      try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(imageOnlyChannels, null, 2));
      } catch (fsErr) {
        console.error(`❌ Error saving image-only settings:`, fsErr);
        return await interaction.editReply({ content: `🚨 Failed to update settings. Check bot logs.` });
      }

      // Send success message
      const modeStatus = imageOnlyChannels[channelId] ? "enabled" : "disabled";
      await interaction.editReply({ content: `✅ Attachments-only mode **${modeStatus}** in this channel.` });

    } catch (err) {
      console.error(`❌ Error executing /imageonly command:`, err);
      await interaction.editReply({ content: `🚨 An unexpected error occurred. Check bot logs.` });
    }
  },
};
