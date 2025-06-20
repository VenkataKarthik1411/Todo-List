import { main } from "./OpenAI.js";
import { API_BASE_URL } from "./constants.js";

(function checkAuth() {
    const userData = localStorage.getItem("userData");
    if (!userData) window.location.replace("login.html");
})();

document.addEventListener("DOMContentLoaded", () => {
    console.log(window.location.origin);
    const userData = localStorage.getItem("userData");
    if (!userData) {
        window.location.replace("login.html");
        return;
    }

    const voiceBtn = document.querySelector(".voice-btn");
    if (voiceBtn) voiceBtn.addEventListener("click", startListening);

    clearTaskOutput();
    setupFilters();
    updateTaskList();
    createUserProfileCircle();
});

function clearTaskOutput() {
    document.getElementById("operation").innerHTML = "";
    document.getElementById("task").innerHTML = "";
    document.getElementById("urgency").innerHTML = "";
    document.getElementById("datetime").innerHTML = "";
    const confirmation = document.getElementById("confirmation-area");
    if (confirmation) confirmation.innerHTML = "";
}

function startListening() {
    if ("webkitSpeechRecognition" in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = "en-US";
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log("Listening...");
            clearTaskOutput();
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Transcript:", transcript);
            await processCommand(transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
        };

        recognition.start();
    } else {
        alert("Web Speech API not supported in this browser");
    }
}

async function processCommand(command) {
    try {
        const jasonResponse = await main(command);
        const aiResponse = JSON.parse(
            jasonResponse.choices[0].message.content.replace(/`/g, "").replace(/\"/g, '"')
        );
        console.log("AI Response:", aiResponse);
        const requestBody = {
            operation: aiResponse.operation,
            task: aiResponse.task,
            urgency: aiResponse.urgency,
            dateTime: aiResponse.datetime
        };

        document.getElementById("operation").textContent = aiResponse.operation;
        document.getElementById("task").textContent = aiResponse.task;
        document.getElementById("urgency").textContent = aiResponse.urgency;
        document.getElementById("datetime").textContent = aiResponse.datetime;

        const confirmationArea = document.getElementById("confirmation-area");
        confirmationArea.innerHTML = `
            <button onclick="window.confirmTask(true)" class="confirm-btn">Confirm</button>
            <button onclick="window.confirmTask(false)" class="cancel-btn">Cancel</button>
        `;

        const jwt = JSON.parse(localStorage.getItem("userData"))?.jwt;
        if (!jwt) {
            alert("User not authenticated. Please log in again.");
            return;
        }

        window.confirmTask = async function (isConfirmed) {
            if (isConfirmed) {
                console.log("requestBody", requestBody);
                const response = await fetch(`${API_BASE_URL}/api/tasks/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        Authorization: `Bearer ${jwt}`
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                clearTaskOutput();
                confirmationArea.innerHTML = "";
                await updateTaskList();
            } else {
                confirmationArea.innerHTML = "";
                startListening();
            }
        };
    } catch (error) {
        console.error("Error processing command:", error);
    }
}

async function getAllTasks() {
    try {
        const userData = JSON.parse(localStorage.getItem("userData"));
        const token = userData?.jwt;
        
        if (!token) {
            console.error("No authentication token found");
            alert("Please log in again to access your tasks");
            window.location.replace("login.html");
            return null;
        }
        
        const loadingIndicator = document.createElement("div");
        loadingIndicator.className = "loading-tasks";
        loadingIndicator.textContent = "Loading tasks...";
        document.getElementById("todo-list").appendChild(loadingIndicator);
        
        const response = await fetch(`${API_BASE_URL}/api/tasks/all`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            },
        });
        
        document.getElementById("todo-list").removeChild(loadingIndicator);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("Your session has expired. Please log in again.");
                localStorage.removeItem("userData");
                window.location.replace("login.html");
                return null;
            }
            throw new Error(`Request failed: ${response.status}`);
        }  
        
        const data = await response.json();
        console.log("Fetched tasks:", data);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error fetching tasks:", error);
        const todoList = document.getElementById("todo-list");
        todoList.innerHTML = `<div class="error-message">Failed to load tasks. Please try again later.</div>`;
        return null;
    }
}

// New function to set up filters
function setupFilters() {
    const filterSection = document.querySelector('.filter-section');
    
    filterSection.innerHTML = `
        <div class="filter-container">
            <h3>Filter Tasks</h3>
            <div class="filter-row">
                <div class="search-box">
                    <input type="text" id="search-input" placeholder="Search tasks...">
                    <button id="search-btn">Search</button>
                </div>
            </div>
            <div class="filter-row">
                <div class="filter-group">
                    <label>Operation:</label>
                    <select id="filter-operation">
                        <option value="">All Operations</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Urgency:</label>
                    <div class="urgency-filters">
                        <button class="urgency-filter-btn" data-urgency="all">All</button>
                        <button class="urgency-filter-btn" data-urgency="high">High</button>
                        <button class="urgency-filter-btn" data-urgency="medium">Medium</button>
                        <button class="urgency-filter-btn" data-urgency="low">Low</button>
                    </div>
                </div>
            </div>
            <div class="filter-row">
                <button id="clear-filters" class="clear-filters-btn">Clear Filters</button>
            </div>
        </div>
    `;
    
    // Setup event listeners after the DOM elements are created
    setupFilterListeners();
}

// Store the filter state
let activeFilters = {
    operation: "",
    urgency: "all",
    searchQuery: ""
};

// Setup filter event listeners
function setupFilterListeners() {
    // Operation filter
    const operationFilter = document.getElementById('filter-operation');
    operationFilter.addEventListener('change', (e) => {
        activeFilters.operation = e.target.value;
        applyFilters();
    });
    
    // Urgency filter buttons
    const urgencyButtons = document.querySelectorAll('.urgency-filter-btn');
    urgencyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            urgencyButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            activeFilters.urgency = btn.dataset.urgency;
            applyFilters();
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    // Search on button click
    searchBtn.addEventListener('click', () => {
        activeFilters.searchQuery = searchInput.value.trim().toLowerCase();
        applyFilters();
    });
    
    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            activeFilters.searchQuery = searchInput.value.trim().toLowerCase();
            applyFilters();
        }
    });
    
    // Clear filters
    const clearFiltersBtn = document.getElementById('clear-filters');
    clearFiltersBtn.addEventListener('click', () => {
        // Reset all filters
        activeFilters = {
            operation: "",
            urgency: "all",
            searchQuery: ""
        };
        
        // Reset UI elements
        operationFilter.value = "";
        searchInput.value = "";
        
        // Reset urgency buttons
        urgencyButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.urgency === 'all') {
                btn.classList.add('active');
            }
        });
        
        // Apply the cleared filters
        applyFilters();
    });
    
    // Set "All" urgency button as active by default
    document.querySelector('.urgency-filter-btn[data-urgency="all"]').classList.add('active');
}

// Update operations dropdown based on available tasks
async function updateOperationFilter(tasks) {
    if (!tasks) return;
    
    const operationFilter = document.getElementById('filter-operation');
    const currentValue = operationFilter.value;
    
    // Clear existing options except the first one
    while (operationFilter.options.length > 1) {
        operationFilter.options.remove(1);
    }
    
    // Extract unique operations
    const operations = [...new Set(tasks.map(task => task.operation))];
    operations.sort();
    
    // Add operation options
    operations.forEach(operation => {
        const option = document.createElement('option');
        option.value = operation;
        option.textContent = operation;
        operationFilter.appendChild(option);
    });
    
    // Restore previously selected value if it still exists
    if (currentValue && operations.includes(currentValue)) {
        operationFilter.value = currentValue;
    }
}

// Apply all active filters to the task list
function applyFilters() {
    const taskItems = document.querySelectorAll('.task-item');
    const operationGroups = document.querySelectorAll('.operation-group');
    
    // If no tasks, nothing to filter
    if (taskItems.length === 0) return;
    
    taskItems.forEach(item => {
        let showTask = true;
        const taskOperation = item.querySelector('.task-operation').textContent;
        const taskContent = item.querySelector('.task-primary').textContent.toLowerCase();
        const taskUrgency = item.getAttribute('data-urgency').toLowerCase();
        
        // Filter by operation
        if (activeFilters.operation && taskOperation !== activeFilters.operation) {
            showTask = false;
        }
        
        // Filter by urgency
        if (activeFilters.urgency !== 'all' && taskUrgency !== activeFilters.urgency) {
            showTask = false;
        }
        
        // Filter by search query
        if (activeFilters.searchQuery && 
            !taskContent.includes(activeFilters.searchQuery) && 
            !taskOperation.toLowerCase().includes(activeFilters.searchQuery)) {
            showTask = false;
        }
        
        // Show or hide task
        item.style.display = showTask ? '' : 'none';
    });
    
    // Hide empty operation groups
    operationGroups.forEach(group => {
        const visibleTasks = group.querySelectorAll('.task-item[style="display: none;"]');
        const totalTasks = group.querySelectorAll('.task-item');
        
        if (visibleTasks.length === totalTasks.length) {
            group.style.display = 'none';
        } else {
            group.style.display = '';
        }
        
        // Update task count if needed
        const taskCount = group.querySelector('.task-count');
        const visibleTaskCount = totalTasks.length - visibleTasks.length;
        if (taskCount) {
            taskCount.textContent = `${visibleTaskCount} task${visibleTaskCount !== 1 ? 's' : ''}`;
        }
    });
    
    // Show "no results" message if all tasks are filtered out
    const todoList = document.getElementById('todo-list');
    const allHidden = Array.from(taskItems).every(item => item.style.display === 'none');
    
    // Remove existing no-results message if any
    const existingMsg = todoList.querySelector('.no-results-message');
    if (existingMsg) todoList.removeChild(existingMsg);
    
    if (allHidden && taskItems.length > 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.textContent = 'No tasks match your filter criteria.';
        todoList.appendChild(noResults);
    }
}

async function updateTaskList() {
    const todoList = document.getElementById("todo-list");
    todoList.innerHTML = "";

    const taskData = await getAllTasks();
    if (!taskData) return;

    if (taskData.length === 0) {
        todoList.innerHTML = `<div class="empty-tasks">No tasks available. Use voice command to add tasks.</div>`;
        return;
    }

    // Update operation filter dropdown with available operations
    updateOperationFilter(taskData);

    // Group tasks by operation
    const tasksByOperation = {};
    taskData.forEach(task => {
        if (!tasksByOperation[task.operation]) {
            tasksByOperation[task.operation] = [];
        }
        tasksByOperation[task.operation].push(task);
    });

    // Create operation groups
    for (const [operation, tasks] of Object.entries(tasksByOperation)) {
        const operationGroup = document.createElement("div");
        operationGroup.className = "operation-group";
        
        // Operation header
        const operationHeader = document.createElement("div");
        operationHeader.className = "operation-header";
        operationHeader.innerHTML = `
            <h3>${operation}</h3>
            <span class="task-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
        `;
        operationGroup.appendChild(operationHeader);
        
        // Tasks container
        const tasksContainer = document.createElement("div");
        tasksContainer.className = "tasks-container";
        
        // Add tasks to operation group - USING SINGLE ROW FORMAT
        tasks.forEach(task => {
            const taskItem = document.createElement("div");
            taskItem.className = "task-item";
            taskItem.setAttribute("data-urgency", task.urgency.toLowerCase());
            taskItem.setAttribute("data-task-id", task.id);
        
            // Add CSS class based on urgency level
            switch (task.urgency.toLowerCase()) {
                case "high":
                    taskItem.classList.add("high-urgency");
                    break;
                case "medium":
                    taskItem.classList.add("medium-urgency");
                    break;
                case "low":
                    taskItem.classList.add("low-urgency");
                    break;
                default:
                    break;
            }
        
            // Single row format with all information inline
            taskItem.innerHTML = `
                <div class="task-main-info">
                    <div class="task-content">
                        <div class="task-operation">${task.operation}</div>
                        <div class="task-primary">${task.task}</div>
                        <div class="task-date">${formatDateTime(task.dateTime)}</div>
                    </div>
                    <div class="task-actions-inline">
                        <button onclick="window.updateTask(${task.id})" class="action-text-btn edit-text-btn">Update</button>
                        <button onclick="window.deleteTask(${task.id})" class="action-text-btn delete-text-btn">Delete</button>
                    </div>
                </div>
            `;
        
            tasksContainer.appendChild(taskItem);
        });
        
        operationGroup.appendChild(tasksContainer);
        todoList.appendChild(operationGroup);
    }
    
    // Apply any active filters after updating the task list
    if (activeFilters.operation || activeFilters.urgency !== 'all' || activeFilters.searchQuery) {
        applyFilters();
    }
}

function createUserProfileCircle() {
    const container = document.getElementById("userProfile");
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData?.email) return;

    const circle = document.createElement("div");
    circle.className = "user-circle";
    circle.textContent = userData.email[0].toUpperCase();

    const dropdown = document.createElement("div");
    dropdown.className = "user-dropdown";
    dropdown.innerHTML = `
        <div class="user-info">
            <strong>Signed in as</strong><br>
            <span class="user-email">${userData?.email}</span>
        </div>
        <div class="dropdown-option logout-option">Sign out</div>
    `;

    dropdown.querySelector(".logout-option").addEventListener("click", () => {
        localStorage.removeItem("userData");
        window.location.href = "login.html";
    });

    circle.addEventListener("click", () => dropdown.classList.toggle("active"));
    document.addEventListener("click", (e) => {
        if (!container.contains(e.target)) dropdown.classList.remove("active");
    });

    container.appendChild(circle);
    container.appendChild(dropdown);
}

// Enhanced delete task function with confirmation and visual feedback
window.deleteTask = async function(id) {
    try {
        if (!confirm("Are you sure you want to delete this task?")) {
            return;
        }
        
        const userData = JSON.parse(localStorage.getItem("userData"));
        const token = userData?.jwt;
        
        if (!token) {
            alert("Please log in again to perform this action");
            window.location.replace("login.html");
            return;
        }
        
        // Find and highlight the task being deleted
        const taskElement = document.querySelector(`.task-item[data-task-id="${id}"]`);
        if (taskElement) {
            taskElement.classList.add("deleting");
        }
        
        const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            if (taskElement) {
                taskElement.classList.add("deleted");
                setTimeout(() => {
                    updateTaskList();
                }, 300); // Short animation before removing
            } else {
                updateTaskList();
            }
        } else if (res.status === 401 || res.status === 403) {
            alert("Your session has expired. Please log in again.");
            localStorage.removeItem("userData");
            window.location.replace("login.html");
        } else {
            throw new Error(`Delete failed: ${res.status}`);
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete task. Please try again.");
    }
};

// Implemented update task functionality with form overlay
window.updateTask = async function(id) {
    try {
        const userData = JSON.parse(localStorage.getItem("userData"));
        const token = userData?.jwt;
        
        if (!token) {
            alert("Please log in again to perform this action");
            window.location.replace("login.html");
            return;
        }
        
        // Fetch the specific task to pre-fill the form
        const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("Your session has expired. Please log in again.");
                localStorage.removeItem("userData");
                window.location.replace("login.html");
                return;
            }
            throw new Error(`Failed to fetch task: ${response.status}`);
        }
        
        const task = await response.json();
        
        // Create update form overlay
        const overlay = document.createElement("div");
        overlay.className = "update-overlay";
        
        overlay.innerHTML = `
            <div class="update-form">
                <h3>Update Task</h3>
                <form id="task-update-form">
                    <div class="form-group">
                        <label for="update-operation">Operation:</label>
                        <input type="text" id="update-operation" value="${task.operation}" required>
                    </div>
                    <div class="form-group">
                        <label for="update-task">Task:</label>
                        <input type="text" id="update-task" value="${task.task}" required>
                    </div>
                    <div class="form-group">
                        <label for="update-urgency">Urgency:</label>
                        <select id="update-urgency" required>
                            <option value="High" ${task.urgency === 'High' ? 'selected' : ''}>High</option>
                            <option value="Medium" ${task.urgency === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Low" ${task.urgency === 'Low' ? 'selected' : ''}>Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="update-datetime">Date & Time:</label>
                        <input type="datetime-local" id="update-datetime" value="${formatDateTimeForInput(task.dateTime)}" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="save-btn">Save Changes</button>
                        <button type="button" class="cancel-btn" id="cancel-update">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Handle form submission
        document.getElementById("task-update-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const updatedTask = {
                operation: document.getElementById("update-operation").value,
                task: document.getElementById("update-task").value,
                urgency: document.getElementById("update-urgency").value,
                dateTime: document.getElementById("update-datetime").value
            };
            
            try {
                const updateResponse = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedTask)
                });
                
                if (!updateResponse.ok) {
                    throw new Error(`Update failed: ${updateResponse.status}`);
                }
                
                document.body.removeChild(overlay);
                updateTaskList();
            } catch (error) {
                console.error("Error updating task:", error);
                alert("Failed to update task. Please try again.");
            }
        });
        
        // Handle cancel button
        document.getElementById("cancel-update").addEventListener("click", () => {
            document.body.removeChild(overlay);
        });
        
        // Close overlay when clicking outside the form
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    } catch (error) {
        console.error("Update error:", error);
        alert("Failed to open update form. Please try again.");
    }
};

// Helper function to format datetime for the input field
function formatDateTimeForInput(dateTimeStr) {
    try {
        // Handle various datetime formats
        const date = new Date(dateTimeStr);
        if (isNaN(date.getTime())) {
            return ""; // Return empty if invalid date
        }
        
        // Format as YYYY-MM-DDThh:mm
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (error) {
        console.error("Error formatting date:", error);
        return "";
    }
}

// Helper function to format datetime for display
function formatDateTime(dateTimeStr) {
    try {
        const date = new Date(dateTimeStr);
        if (isNaN(date.getTime())) {
            return dateTimeStr; // Return as is if invalid
        }
        
        // Format as user-friendly string
        return date.toLocaleString();
    } catch (error) {
        return dateTimeStr;
    }
}