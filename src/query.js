module.exports = {
    createTodosTable: `
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            listMessage TEXT NOT NULL,
            date TEXT NOT NULL,
            active BOOLEAN NOT NULL
        );
    `,
    
    createTasksTable: `
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            completed BOOLEAN NOT NULL,
            daily BOOLEAN NOT NULL,
            todo_id INTEGER,
            FOREIGN KEY (todo_id) REFERENCES todos (id)
        );
    `,

    insertTodo: `
        INSERT INTO todos (username, listMessage, date, active) VALUES (?, ?, ?, ?);
    `,

    insertTask: `
        INSERT INTO tasks (description, completed, daily, todo_id) VALUES (?, ?, ?, ?);
    `,

    getDailyTasks: `
        SELECT * FROM tasks WHERE daily = true;
    `,


    getTasks: `
        SELECT * FROM tasks WHERE todo_id = ?;
    `,

    getTodo: `
        SELECT * FROM todos WHERE username = ? AND active = true;
    `,

    getTodos: `
        SELECT * FROM todos WHERE username = ?;
    `,

    updateTask: `
        UPDATE tasks SET description = ?, completed = ? WHERE id = ?;
    `,

    deactivateTodos: `
        UPDATE todos SET active = false WHERE username = ?;
    `,

    deleteTask: `
        DELETE FROM tasks WHERE id = ?;
    `,
    deleteTasksByTodoId: `
    DELETE FROM tasks WHERE todo_id = ?;
    `,
    deleteTodo: `
        DELETE FROM todos WHERE username = ?;
    `
};
