// professor-chatbot.js - Groq AI Teaching Assistant Chatbot
// Uses same API key as student chatbot but with professor-focused prompts

const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

let chatHistory = [];
let classContext = null;

// ✅ Initialize chatbot with class data
export function initProfessorChatbot(analysisData) {
    classContext = analysisData;
    chatHistory = [{
        role: 'system',
        content: buildSystemPrompt(analysisData)
    }];
    console.log('✅ Professor chatbot initialized!');
}

// ✅ Build system prompt with class context
function buildSystemPrompt(data) {
    const { stats, commonMistakes } = data;
    
    const mistakesText = commonMistakes && commonMistakes.length > 0
        ? commonMistakes.map((m, i) => 
            `${i + 1}. Topic: "${m.question}"\n   ${m.count} students (${Math.round((m.count / stats.totalAttempts) * 100)}%) got this wrong\n   Correct answer: ${m.correctAnswer}`
        ).join('\n\n')
        : 'No common mistakes - students are doing great! 🎉';
    
    return `You are an expert teaching assistant helping a professor improve their class instruction.

**Class Performance Overview:**
- Total Students: ${stats.uniqueStudents}
- Class Average: ${stats.classAvg}%
- Highest Score: ${stats.highest}%
- Lowest Score: ${stats.lowest}%
- Students Struggling (< 60%): ${stats.strugglingStudents}
- Excellent Students (≥ 85%): ${stats.excellentStudents}
- Total Quiz Attempts: ${stats.totalAttempts}

**Common Topics Students Struggle With:**
${mistakesText}

**Your Role:**
- Suggest evidence-based teaching strategies
- Recommend classroom activities to reinforce weak topics
- Advise on student engagement techniques
- Provide pedagogical best practices
- Help identify students who need extra support
- Suggest assessment strategies

**Important Guidelines:**
- Be supportive and encouraging of the professor's teaching efforts
- Provide SPECIFIC, actionable advice (not generic tips)
- Reference the ACTUAL class data and common mistakes
- Use educational research and teaching methodologies when relevant
- Keep responses concise (2-4 sentences unless explaining a complex strategy)
- Use emojis occasionally to stay friendly 😊
- If the class is doing well, focus on enrichment and advanced strategies

**Tone:**
Professional, supportive, and solution-oriented. You're a colleague helping improve teaching effectiveness.`;
}

// ✅ Send message to Groq AI
export async function sendTeachingMessage(userMessage) {
    try {
        if (!classContext) {
            return {
                success: false,
                message: "Oops! Class context not loaded. Please refresh the page and try again."
            };
        }

        // Add user message to history
        chatHistory.push({
            role: 'user',
            content: userMessage
        });

        console.log('💬 Sending to Groq AI (Professor Mode)...');
        console.log('📝 Message:', userMessage);

        // Call Groq API
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: chatHistory,
                temperature: 0.7,
                max_tokens: 450,
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

// ✅ Get suggested questions based on class performance
export function getProfessorSuggestedQuestions() {
    if (!classContext) return [];
    
    const { stats, commonMistakes } = classContext;
    const suggestions = [];
    
    // If there are common mistakes
    if (commonMistakes && commonMistakes.length > 0) {
        const topMistake = extractTopicFromQuestion(commonMistakes[0].question);
        suggestions.push(`How can I better explain ${topMistake}?`);
        suggestions.push(`What activities would help students understand this topic?`);
    }
    
    // If students are struggling
    if (stats.strugglingStudents > 0) {
        suggestions.push(`How can I help the ${stats.strugglingStudents} struggling student(s)?`);
        suggestions.push('What intervention strategies work best?');
    }
    
    // If class is doing well
    if (stats.classAvg >= 80) {
        suggestions.push('How can I challenge high-performing students?');
        suggestions.push('What enrichment activities would you recommend?');
    }
    
    // General teaching questions
    if (stats.uniqueStudents < 10) {
        suggestions.push('How can I increase student participation?');
    }
    
    suggestions.push('What are best practices for quiz design?');
    suggestions.push('How can I improve student engagement?');
    
    return suggestions.slice(0, 4); // Return max 4 suggestions
}

function extractTopicFromQuestion(question) {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.match(/array|list/)) return 'arrays';
    if (lowerQ.match(/loop|for|while/)) return 'loops';
    if (lowerQ.match(/function|method/)) return 'functions';
    if (lowerQ.match(/variable/)) return 'variables';
    if (lowerQ.match(/object|class/)) return 'objects';
    if (lowerQ.match(/\+|add/)) return 'addition';
    if (lowerQ.match(/\*|multiply/)) return 'multiplication';
    
    return 'this concept';
}

// ✅ Clear chat history (keeps system prompt)
export function clearProfessorChat() {
    if (classContext) {
        chatHistory = [{
            role: 'system',
            content: buildSystemPrompt(classContext)
        }];
        console.log('🗑️ Chat history cleared');
    } else {
        chatHistory = [];
    }
}

// ✅ Get chat history for display (excludes system prompt)
export function getProfessorChatHistory() {
    return chatHistory.filter(msg => msg.role !== 'system');
}