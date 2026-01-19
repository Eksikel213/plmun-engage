// report-chatbot.js - Groq AI Chatbot (READY TO USE!)
// ✅ Your API key is already configured

const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

let chatHistory = [];
let studentContext = null;

// ✅ Initialize chatbot with student data
export function initChatbot(analysisData) {
    studentContext = analysisData;
    chatHistory = [{
        role: 'system',
        content: buildSystemPrompt(analysisData)
    }];
    console.log('✅ Groq chatbot initialized!');
}

// ✅ Build system prompt with student's quiz context
function buildSystemPrompt(data) {
    const { latestQuiz, wrongAnswers, stats } = data;
    
    const wrongQText = wrongAnswers.length > 0
        ? wrongAnswers.map((wa, i) => 
            `${i + 1}. Question: "${wa.question}"\n   Student answered: "${wa.userAnswer}"\n   Correct answer: "${wa.correctAnswer}"`
        ).join('\n\n')
        : 'Student got all questions correct! 🎉';
    
    return `You are a friendly, encouraging AI tutor helping a student improve their quiz performance.

**Student's Latest Quiz:**
- Quiz Title: ${latestQuiz.quizTitle}
- Score: ${latestQuiz.score}/${latestQuiz.totalQuestions} (${latestQuiz.percentage}%)
- Date: ${new Date(latestQuiz.completedAt).toLocaleDateString()}

**Questions Student Got Wrong:**
${wrongQText}

**Overall Performance:**
- Total Quizzes Taken: ${stats.totalQuizzes}
- Average Score: ${stats.avgPercentage}%
- Performance Trend: ${stats.trend}

**Your Role:**
- Answer questions about their quiz performance
- Explain why certain answers were wrong in simple terms
- Provide specific study tips based on their mistakes
- Be encouraging, supportive, and motivating
- Keep responses concise (2-4 sentences unless explaining a complex concept)
- Use emojis occasionally to stay friendly and engaging 😊
- If they got everything right, suggest advanced topics to study next

**Important Guidelines:**
- Always refer to their ACTUAL quiz questions and mistakes
- When explaining, break down concepts clearly
- Suggest concrete, actionable study methods
- Celebrate their successes and progress
- Be patient and never judgmental`;
}

// ✅ Send message to Groq AI
export async function sendMessage(userMessage) {
    try {
        if (!studentContext) {
            return {
                success: false,
                message: "Oops! Context not loaded. Please refresh the page and try again."
            };
        }

        // Add user message to history
        chatHistory.push({
            role: 'user',
            content: userMessage
        });

        console.log('💬 Sending to Groq AI...');
        console.log('📝 Message:', userMessage);

        // Call Groq API
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Fast & smart model
                messages: chatHistory,
                temperature: 0.7,
                max_tokens: 400,
                top_p: 1,
                stream: false
            })
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Groq API Error:', errorData);
            
            if (response.status === 401) {
                return {
                    success: false,
                    message: "⚠️ API Key Error! Please check your Groq API key configuration."
                };
            }
            
            if (response.status === 429) {
                return {
                    success: false,
                    message: "⚠️ Rate limit reached. Please wait a moment and try again."
                };
            }
            
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0]?.message?.content) {
            throw new Error('Invalid response structure from Groq');
        }

        const aiResponse = data.choices[0].message.content.trim();
        console.log('✅ AI Response received:', aiResponse.substring(0, 50) + '...');

        // Add AI response to history
        chatHistory.push({
            role: 'assistant',
            content: aiResponse
        });

        return {
            success: true,
            message: aiResponse
        };

    } catch (error) {
        console.error('❌ Chat error:', error);
        return {
            success: false,
            message: `Sorry, I encountered an error: ${error.message} 😅 Please try again!`
        };
    }
}

// ✅ Get suggested questions based on student's performance
export function getSuggestedQuestions() {
    if (!studentContext) return [];
    
    const { wrongAnswers, stats, latestQuiz } = studentContext;
    const suggestions = [];
    
    if (wrongAnswers.length > 0) {
        // If they got questions wrong, suggest specific help
        suggestions.push(`Why did I get question 1 wrong?`);
        suggestions.push(`Can you explain the correct answer?`);
        suggestions.push(`How can I improve on these topics?`);
        suggestions.push(`What study method works best for this?`);
    } else {
        // If they got everything right, suggest advancement
        suggestions.push(`What advanced topics should I study next?`);
        suggestions.push(`How can I keep my perfect score?`);
        suggestions.push(`Tips for harder quizzes?`);
        suggestions.push(`What concepts should I master?`);
    }
    
    // Always include general study tips
    if (stats.totalQuizzes > 1) {
        suggestions.push(`How's my overall progress?`);
    }
    
    return suggestions.slice(0, 4); // Return max 4 suggestions
}

// ✅ Clear chat history (keeps system prompt)
export function clearChat() {
    if (studentContext) {
        chatHistory = [{
            role: 'system',
            content: buildSystemPrompt(studentContext)
        }];
        console.log('🗑️ Chat history cleared');
    } else {
        chatHistory = [];
    }
}

// ✅ Get chat history for display (excludes system prompt)
export function getChatHistory() {
    return chatHistory.filter(msg => msg.role !== 'system');
}