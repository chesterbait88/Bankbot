// agreement.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('agreement')
    .setDescription('Post the welcome message with the agreement button.'),
    
  async execute(interaction) {
    // Create the "Click To Agree" button.
    const agreeButton = new ButtonBuilder()
      .setCustomId('agree_button')
      .setLabel('Click To Agree')
      .setStyle(ButtonStyle.Primary);

    // Add the button to an action row.
    const row = new ActionRowBuilder().addComponents(agreeButton);

    // Build the message payload based on your provided JSON.
    const messagePayload = {
      content: "Welcome to the Bank Of Styx",
      tts: false,
      embeds: [
        {
          id: 866941841, // Note: Custom id properties may be ignored by Discord.
          title: "Features",
          description: "Commands:  ㅤㅤㅤ     Description:\n/BalanceㅤㅤㅤㅤㅤChecks your balance\n/DepositㅤㅤㅤㅤㅤPut NS in the bank\n/WithdrawㅤㅤㅤㅤPull NS out back into Nation \n/Transferㅤㅤ  ㅤ ㅤTransfer NS Between Users",
          fields: [],
          color: 10813440
        },
        {
          id: 652627557, // Note: Custom id properties may be ignored by Discord.
          title: "Rules to agree to",
          description: "📜Rules \n\n1️⃣ㅤ *** Be nice***\n2️⃣ㅤ ***Have Fun!***",
          fields: [],
          color: 26331
        }
      ],
      components: [row],
      username: "La Maga Demonios",
      avatar_url: "https://cdn.discordapp.com/attachments/1240902911282774038/1240903692484477018/Sorceress_logo_black_outline_no_background.jpg?ex=67a8419f&is=67a6f01f&hm=21d6973633e742d156c9ec30f465b8e4d687ad760ce6d49e12cf1b94953922fc&"
    };

    // Reply with the message payload as an ephemeral response using flags: 64.
    await interaction.reply({ ...messagePayload });
  }
};
