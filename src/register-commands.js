require("dotenv").config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js')

const commands = [
  {
    name: 'help',
    description: 'Lists commands',
    options: [
      {
        name: "command",
        description: "command",
        type: ApplicationCommandOptionType.String
      }

    ]
  },
];

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Error:', error);
  }
})();