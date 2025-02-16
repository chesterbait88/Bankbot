// index.js

// Load environment variables from .env
require('dotenv').config();

// Import required modules
const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  REST, 
  Routes,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalBuilder // <-- new import for modals
} = require('discord.js');

const bank = require('./bank.js'); // Ensure the bank module is imported if needed

// Create a new Discord client instance with necessary intents and partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Prepare a collection for commands and an array for slash command data
client.commands = new Collection();
const commands = [];

/* ===================================================
   Load Command Files Dynamically
   =================================================== */
const commandFiles = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    } else {
      console.warn(
        `⚠️ Skipping ${file}: Missing required "data" or "execute" field.`
      );
    }
  } catch (error) {
    console.error(`❌ Error loading command file: ${file}`, error);
  }
}

/* ===================================================
   Register Slash Commands with Discord
   =================================================== */
(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ Slash commands registered successfully.`);
  } catch (error) {
    console.error(`🚨 Error registering commands:`, error);
  }

  // Log the client in after registering commands
  client.login(process.env.TOKEN);
})();

/* ===================================================
   Client Ready Event
   =================================================== */
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log('successfully finished startup');
});

/* ===================================================
   Ensure imageonly.json Exists
   =================================================== */
const imageOnlyPath = path.join(__dirname, './data/imageonly.json');

if (!fs.existsSync(imageOnlyPath)) {
  console.log('⚠️ imageonly.json not found. Creating a new one...');
  fs.writeFileSync(imageOnlyPath, JSON.stringify({}), 'utf8');
}

/* ===================================================
   Enforce Image-Only Channels
   =================================================== */
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  let imageOnlyChannels = {};
  try {
    const data = fs.readFileSync(imageOnlyPath, 'utf8');
    imageOnlyChannels = JSON.parse(data);
  } catch (err) {
    console.error('❌ Error reading image-only settings:', err);
    return;
  }

  // If the channel is set to be image-only and the message has no attachments, delete it
  if (imageOnlyChannels[message.channel.id]) {
    if (!message.attachments.size) {
      try {
        await message.delete();
      } catch (err) {
        console.error('❌ Error deleting non-image message:', err);
      }
    }
  }
});

/* ===================================================
   Handle Slash Commands
   =================================================== */
client.on('interactionCreate', async (interaction) => {
  // Existing slash command handler...
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      await interaction.reply({
        content: '🚨 An error occurred while executing this command.',
        ephemeral: true,
      });
    }
    return;
  }

/* ===================================================
   Welcome New Guild Members
   =================================================== */
client.on('guildMemberAdd', async (member) => {
  // Find the role named "Landing" (case-insensitive)
  const landingRole = member.guild.roles.cache.find(
    (role) => role.name.toLowerCase() === 'landing'
  );

  if (!landingRole) {
    console.error(`Landing role not found in guild "${member.guild.name}".`);
    return;
  }

  try {
    // Assign the Landing role to the new member
    await member.roles.add(landingRole);
    console.log(`Landing role added to ${member.user.tag}.`);
  } catch (error) {
    console.error(`Error adding Landing role to ${member.user.tag}:`, error);
  }
});

/* ===================================================
   Handle Modal Submissions (Button Interactions)
   =================================================== */

 if (interaction.isButton()) {
    switch (interaction.customId) {
      case 'teller_balance': {
        const balanceCmd = client.commands.get('balance');
        if (balanceCmd) {
          // Note: Ensure the balance command can handle a button interaction context
          await balanceCmd.execute(interaction);
        } else {
          await interaction.reply({ content: 'Balance command not found.', ephemeral: true });
        }
        break;
      }
      case 'teller_transfer': {
        const transferCmd = client.commands.get('transfer');
        if (transferCmd) {
          await transferCmd.execute(interaction);
        } else {
          await interaction.reply({ content: 'Transfer command not found.', ephemeral: true });
        }
        break;
      }
      case 'teller_statement': {
        const ministatementCmd = client.commands.get('ministatement');
        if (ministatementCmd) {
          await ministatementCmd.execute(interaction);
        } else {
          await interaction.reply({ content: 'Ministatement command not found.', ephemeral: true });
        }
        break;
      }
      case 'teller_withdraw': {
        const withdrawCmd = client.commands.get('withdraw');
        if (withdrawCmd) {
          await withdrawCmd.execute(interaction);
        } else {
          await interaction.reply({ content: 'Withdraw command not found.', ephemeral: true });
        }
        break;
      }
      case 'teller_deposit': {
        const depositCmd = client.commands.get('deposit');
        if (depositCmd) {
          await depositCmd.execute(interaction);
        } else {
          await interaction.reply({ content: 'Deposit command not found.', ephemeral: true });
        }
        break;
      }
      default:
        // If you have other buttons (e.g. the agree_button), handle those here too.
        break;
    }
  }
});


client.on('interactionCreate', async (interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    if (interaction.customId === 'agree_button') {
      // Create a modal to collect additional user info
      const modal = new ModalBuilder()
        .setCustomId('agreement_modal')
        .setTitle('User Verification');

      // Create text input components (one per ActionRow)
      const firstNameInput = new TextInputBuilder()
        .setCustomId('first_name')
        .setLabel("Enter your real first name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const lastNameInput = new TextInputBuilder()
        .setCustomId('last_name')
        .setLabel("Enter your real last name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const pirateNameInput = new TextInputBuilder()
        .setCustomId('pirate_name')
        .setLabel("Enter your pirate name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const emailInput = new TextInputBuilder()
        .setCustomId('email')
        .setLabel("Enter your email address")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      // Each input must be added in its own ActionRow
      const firstRow = new ActionRowBuilder().addComponents(firstNameInput);
      const secondRow = new ActionRowBuilder().addComponents(lastNameInput);
      const thirdRow = new ActionRowBuilder().addComponents(pirateNameInput);
      const fourthRow = new ActionRowBuilder().addComponents(emailInput);

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

      // Show the modal to the user
      await interaction.showModal(modal);
    }
  }

  // Handle modal submissions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'agreement_modal') {
      // Retrieve submitted values
      const firstName = interaction.fields.getTextInputValue('first_name');
      const lastName = interaction.fields.getTextInputValue('last_name');
      const pirateName = interaction.fields.getTextInputValue('pirate_name');
      const email = interaction.fields.getTextInputValue('email');
      const realName = `${firstName} ${lastName}`;
      const userId = interaction.user.id;

      // Update user info in the database (using your bank.js function)
      const success = await bank.updateUserInfo(userId, pirateName, realName, null, email, null);
      if (!success) {
        return await interaction.reply({
          content: 'Error saving your information. Please contact an admin.',
          ephemeral: true,
        });
      }

      // Now switch roles: remove Landing and add BoSMember
      const landingRole = interaction.guild.roles.cache.find(
        (role) => role.name.toLowerCase() === 'landing'
      );
      const bosMemberRole = interaction.guild.roles.cache.find(
        (role) => role.name === 'BoSMember'
      );

      if (!landingRole || !bosMemberRole) {
        return await interaction.reply({
          content: 'Role configuration error. Please contact an admin.',
          ephemeral: true,
        });
      }

      try {
        await interaction.member.roles.remove(landingRole);
        await interaction.member.roles.add(bosMemberRole);

        // Locate target channel if needed (as in your existing logic)
        const targetChannel = interaction.guild.channels.cache.find(
          (ch) => ch.name === 'ꓭ∀ꓤ_ǝ𝗵ꓕ'
        );
        const channelMention = targetChannel ? `<#${targetChannel.id}>` : 'the general chat';

        await interaction.reply({
          content: `Thank you! Your information has been saved and you have been verified. Please enjoy the Bank. Click here ➡️ ${channelMention} to move to general chat.`,
          ephemeral: true,
        });

        if (targetChannel) {
          await targetChannel.send(`<@${interaction.user.id}> has joined the BoS.`);
        }
      } catch (error) {
        console.error('Error updating roles:', error);
        return await interaction.reply({
          content: 'There was an error updating your roles. Please contact an admin.',
          flag: 64,
        });
      }
    }
  }
});
