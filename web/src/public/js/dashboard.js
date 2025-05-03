// Connect to Socket.IO server
const socket = io();

// Update bot status
function updateBotStatus(status) {
    document.getElementById('connectionStatus').textContent = status.isConnected ? 'Connected' : 'Disconnected';
    document.getElementById('botPosition').textContent = `X: ${status.position.x}, Y: ${status.position.y}, Z: ${status.position.z}`;
    document.getElementById('botHealth').textContent = `${status.health}/20`;
    document.getElementById('botFood').textContent = `${status.food}/20`;
}

// Update current task
function updateCurrentTask(task) {
    const taskElement = document.getElementById('currentTask');
    if (task) {
        taskElement.textContent = `${task.type}: ${JSON.stringify(task.parameters)}`;
    } else {
        taskElement.textContent = 'No active task';
    }
}

// Add task to history
function addTaskToHistory(task) {
    const historyElement = document.getElementById('taskHistory');
    const taskElement = document.createElement('div');
    taskElement.className = 'p-2 bg-gray-50 rounded';
    taskElement.textContent = `${new Date().toLocaleString()} - ${task.type}: ${JSON.stringify(task.parameters)}`;
    historyElement.insertBefore(taskElement, historyElement.firstChild);
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('requestBotStatus');
});

socket.on('botStatus', (status) => {
    updateBotStatus(status);
});

socket.on('taskUpdate', (update) => {
    if (update.status === 'started') {
        updateCurrentTask(update.task);
    } else if (update.status === 'completed') {
        addTaskToHistory(update.task);
        updateCurrentTask(null);
    }
});

// Form submission handler
document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const taskType = document.getElementById('taskType').value;
    const taskParams = JSON.parse(document.getElementById('taskParams').value);
    
    const task = {
        id: Date.now(),
        type: taskType,
        parameters: taskParams
    };
    
    socket.emit('executeTask', task);
    
    // Clear form
    document.getElementById('taskParams').value = '';
});

// Request initial bot status
socket.emit('requestBotStatus'); 