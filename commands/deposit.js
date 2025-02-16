// deposit.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Request a deposit.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of NS to deposit')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('nation_username')
                .setDescription("Your Nation's Facebook bank account Name")
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('transaction_receipt')
                .setDescription('Upload a screenshot of the "Completed" transaction chat log')
                .setRequired(true)
        ),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const nationUsername = interaction.options.getString('nation_username');
        const receipt = interaction.options.getAttachment('transaction_receipt');

        if (!receipt || !receipt.url) {
            return interaction.reply({
                content: '🚨 You must upload a screenshot of your transaction receipt.',
                flags: 64 
            });
        }

        // Pass the user ID and user tag (discordUsername) to requestDeposit.
        const success = await bank.requestDeposit(
            interaction.user.id,
            interaction.user.tag,
            nationUsername,
            amount,
            receipt.url
        );

        if (success) {
            // Respond privately to the user
            await interaction.reply({
                content: `Your deposit request for **${amount} NS** with Nation Username **${nationUsername}** has been logged. Awaiting admin approval.`,
                flags: 64 
            });

            // Fetch the admin role from the guild using its ID from the environment
            const adminRole = interaction.guild.roles.cache.get(process.env.ADMIN_ROLE_ID);
            if (adminRole) {
                // Iterate over each member with the admin role and send a DM
                adminRole.members.forEach(member => {
                    member.send(
                        `New deposit request submitted by **${interaction.user.tag}** for **${amount} NS** with Nation Username **${nationUsername}**. Receipt: ${receipt.url}`
                    ).catch(err => {
                        console.error(`Could not DM admin ${member.user.tag}:`, err);
                    });
                });
            } else {
                console.error(`Admin role with ID ${process.env.ADMIN_ROLE_ID} not found.`);
            }
        } else {
            await interaction.reply({
                content: '🚨 Failed to process deposit request. Contact an admin.',
                flags: 64 
            });
        }
    },
};
