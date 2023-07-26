const cron = require('node-cron');
require("dotenv").config();
const { Client, IntentsBitField, PermissionsBitField, EmbedBuilder } = require('discord.js')

const db = require('./db.js');
const queries = require('./query.js');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
    ]
});

const Tasks = [];

const today = new Date();
const dateStr = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

client.on('ready', (c) => {
    console.log(`${c.user.tag} is online!`);
    db.run(queries.createTodosTable);
    db.run(queries.createTasksTable);
    cron.schedule('0 8 * * *', async function() {
        console.log('running a task every day at 8 AM');
        client.guilds.cache.each(async guild => {
            guild.channels.cache.each(async channel => {
                if (channel.name.startsWith('todo-')) {
                    const username = channel.name.slice('todo-'.length);
                    let user;
                    try {
                        await guild.members.fetch();
                        user = guild.members.cache.find(member => member.user.username === username);
                    } catch(err) {
                        console.error(err);
                    }
                    if (user) {
                        channel.send(`${user}, your daily todo list has been created!`);
                        const listMessage = await channel.send(`Tasks for ${dateStr}:\n No tasks yet.`);
                        let dailyTasks = db.all(queries.getDailyTasks)

                        db.run(queries.deactivateTodos, [username])
                        db.run(queries.insertTodo, [message.author, listMessage.id, dateStr, true]);
                        const todolist = await db.get(queries.getTodo, [user]);
                        if (dailyTasks && dailyTasks.length > 0) {
                            dailyTasks.forEach(task => {
                                db.run(queries.insertTask, [task.description, false, task.daily, todolist.id]);
                            });
                        }
                    }
                }
            });
        });
    });
    const sendReminder = () => {
        const updateChannel = client.channels.cache.get('update_channel_id');
      
        updateChannel.send('@everyone, please remember to give an update!');
      };
      
      cron.schedule('0 12 * * *', sendReminder);
      cron.schedule('0 17 * * *', sendReminder);
});

client.on('channelDelete', async (channel) => {
    if (channel.type !== 'GUILD_TEXT') return;
    
    // Get the channel name which should be the user's ID
    if (!channel.name.startsWith('todo-')) return;

    let username = channel.name.slice('todo-'.length);
    
    // Fetch the user's todo from the database
    let userTodo = await db.get(queries.getTodos, [username]);

    // If there is no corresponding todo, do nothing
    if (!userTodo) return;

    // Delete the tasks first to maintain foreign key constraints
    await db.run(queries.deleteTasksByTodoId, [userTodo.id]);
    
    // Then delete the todo
    await db.run(queries.deleteTodo, [username]);
    console.log("deleted!")
});


client.on('messageCreate', async message => {
    const content = message.content.trim();
    const channelName = message.channel.name;
    const command = content.split(' ')[0];
    const argument = content.slice(command.length).trim();

    if (command === "!create-todo") {

        if (message.channel.name !== "todo") {
            message.reply("You can only run this command in the 'todo' channel.");
            return;
        }

        const mewChannelName = `todo-${message.author.username}`;
        const channelList = message.guild.channels.cache;
        const hasChannel = channelList.some(channel => channel.name === mewChannelName);

        if (hasChannel) {
            message.reply("You already have a todo channel!");
        } else {
            try {
                const newChannel = await message.guild.channels.create({
                    name: mewChannelName,
                    type: 0,
                    permissionOverwrites: [
                        {
                            id: message.guild.roles.everyone, 
                            allow: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: message.author.id, 
                            allow: [
                                PermissionsBitField.Flags.ViewChannel, 
                                PermissionsBitField.Flags.SendMessages, 
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        },
                    ],
                });

                newChannel.send(`${message.author}, your todo channel has been created!`);

                const listMessage = await newChannel.send(`Tasks for ${dateStr}:\n No tasks yet`);
                db.run(queries.insertTodo, [message.author.username, listMessage.id, dateStr, true]);
            
                const categoryId = "1130555817368764578"
                newChannel.setParent(categoryId)
                message.delete().catch(console.error);
            } catch (err) {
                console.error("Error while creating a channel: ", err.message);
                console.error("Error code: ", err.code);
                console.error("HTTP status: ", err.httpStatus);
                console.error("Requested data: ", err.method, err.path);
            }
        }
    }


    const updateListMessage = async () => {
        const username = channelName.slice('todo-'.length); // extract username from the channel name
        const row = await db.get(queries.getTodos, [username]);
    
        if (row) {
            const tasks = await db.all(queries.getTasks, [row.id]);
            const listMessage = await message.channel.messages.fetch(row.listMessage);
            const taskList = tasks
                .map((task, i) => `${i + 1}. ${task.description} - ${task.completed ? 'Completed' : 'Not completed'}`)
                .join('\n');
            await listMessage.edit(`Tasks for ${dateStr}:\n${taskList}`);
        }
    };

    async function executeCommand(todoCommand, todoArgument, todolist, message, db) {
        switch (todoCommand) {
            case "add":
                if (todoArgument.split(' ')[0] === "daily") {
                    let argument = todoArgument.slice(todoArgument.split(' ')[0].length).trim();
                    await db.run(queries.insertTask, [argument, false, true, todolist.id]);
                    break;
                } else {
                    await db.run(queries.insertTask, [todoArgument, false, false, todolist.id]);
                    break;
                }
            case "remove":
            case "complete":
            case "uncomplete":
            case "update":
                const [taskNumber, newDescription] = parseArgument(todoArgument);
                const tasks = await db.all(queries.getTasks, [todolist.id]);
                const task = tasks[taskNumber];
                console.log(taskNumber)
                if (task) {
                    switch (todoCommand) {
                        case "remove":
                            await db.run(queries.deleteTask, [task.id]);
                            break;
                        case "complete":
                            await db.run(queries.updateTask, [task.description, true, task.id]);
                            break;
                        case "uncomplete":
                            await db.run(queries.updateTask, [task.description, false, task.id]);
                            break;
                        case "update":
                            if (newDescription) {
                                await db.run(queries.updateTask, [newDescription, task.completed, task.id]);
                            } else {
                                return message.reply(`Invalid command format. Please use "update [task number] [new description]"`);
                            }
                            break;
                    }
                } else {
                    return message.reply(`Invalid task number: "${todoArgument}"`);
                }
                break;
            default:
                return message.reply("Invalid command.");
        }
    
        await updateListMessage();
        message.delete().catch(console.error);
    }
    
    function parseArgument(argument) {
        const [firstWord, ...restWords] = argument.split(' ');
        const taskNumber = parseInt(firstWord, 10);
        const newDescription = restWords.join(' ');
    
        return [taskNumber - 1, newDescription];
    }
    
    
    if (command === "!todo") {
        if (channelName !== `todo-${message.author.username}`) {
            message.reply("You can only create todo list in your own todo channel.");
            return;
        }
    
        const todoCommand = argument.split(' ')[0];
        const todoArgument = argument.slice(todoCommand.length).trim();
        const todolist = await db.get(queries.getTodo, [message.author.username]);
    
        if (todolist) {
            executeCommand(todoCommand, todoArgument, todolist, message, db)
                .catch(error => console.error(error));
        } else {
            message.reply("No active todo list found.");
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'help') {
        const command = interaction.options.getString('command');
        const commandDetails = {
            'create-todo': 'Creates a new todo list.',
            'add': 'Adds a task to the todo list. The "daily" flag is optional, and if set, the task will be added daily. The message should describe the task.',
            'remove': 'Removes a task from the todo list. The task is specified by its number.',
            'complete': 'Marks a task as complete. The task is specified by its number.',
            'uncomplete': 'Marks a task as not complete. The task is specified by its number.',
            'update': 'Updates the description of a task. The task is specified by its number, and the new message should describe the updated task.',
        };
        const embed = new EmbedBuilder()
            .setColor(0xff0000) // The color of the side bar, use hexadecimal color

        if (command && command in commandDetails) {
            embed.setTitle('command')
            embed.setDescription(`\`\`\`css\n!${command}\n${commandDetails[command]}\`\`\``);
        } else {
            embed.setTitle('Available Commands')
            embed.setDescription(`
\`\`\`css
!create-todo
!todo
    - add [daily (optional)] <task message>
    - remove <task #>
    - complete <task #>
    - uncomplete <task #>
    - update <task #> <new task message>
\`\`\`
            `);
        }

        await interaction.reply({ embeds: [embed] });
    }
});

client.login(
    process.env.TOKEN
);
