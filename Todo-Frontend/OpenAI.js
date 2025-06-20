import OpenAI from "https://cdn.skypack.dev/openai";
import { API_BASE_URL } from "./constants.js";

// Function to check if user is authenticated and retrieve the API token
async function getAccessToken() {
  try {
    // Get JWT from localStorage
    const userData = JSON.parse(localStorage.getItem("userData"));
    const jwt = userData ? userData.jwt : null;
    
    // If no JWT is found, redirect to login page
    if (!jwt) {
      console.log("No JWT found, redirecting to login page");
      window.location.href = "login.html";
      return null;
    }
    
    // Make request to backend to get the OpenAI token
    const response = await fetch(`${API_BASE_URL}/api/token/github`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json', 
        'Accept': 'application/json' ,
        'Authorization': `Bearer ${jwt}`
      }
    });
    // If response is not ok (e.g. 401 Unauthorized)
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.log("Authentication failed, redirecting to login page ");
        // Clear invalid JWT
        localStorage.removeItem('jwt');
        window.location.href = "login.html";
        return null;
      }
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    // Parse and return the token
    const data = await response.json();
    console.log("Token retrieved successfully:", data);
    return data.token;
    
  } catch (error) {
    console.error("Error retrieving access token:", error);
    alert("Error connecting to the server. Please try again later.");
    return null;
  }
}

export async function main(userCommand) {
  // First get the token
  const token = await getAccessToken();
  
  // If token retrieval failed or user was redirected to login
  if (!token) {
    return null;
  }
  
  try {
    const client = new OpenAI({
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: token,
      dangerouslyAllowBrowser: true
    });

    const response = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a task analyzer. Extract the following details from the user's input:
          1. Operation (Add/Delete/Update)
          2. Task description
          3. Urgency (High/Medium/Low)
          4. Date and Time (if mentioned in dd/mm/yyyy format)
          
          Respond in JSON format like:
          {
            "operation": "...",
            "task": "...",
            "urgency": "...",
            "datetime": "..."
          }
          
          Keep the task field case-insensitive for comparison purposes.`
        },
        {
          role: "user",
          content: userCommand
        }
      ],
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1
    });

    return response;
  } catch (error) {
    console.error("Error processing command:", error);
    
    // If the error is related to authentication
    if (error.status === 401 || error.message.includes("unauthorized")) {
      alert("Your session has expired. Please log in again.");
      localStorage.removeItem('jwt');
      window.location.href = "login.html";
      return null;
    }
    
    alert("Error processing your command. Please try again later.");
    return null;
  }
}