import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { prompt } = await req.json()
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

        if (!GEMINI_API_KEY) {
            throw new Error('Missing Gemini API Key')
        }

        if (!prompt) {
            throw new Error('Missing prompt in request body')
        }

        // Call Google Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch from Gemini')
        }

        // Extract the text from the response
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated."

        return new Response(
            JSON.stringify({ text: generatedText }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
