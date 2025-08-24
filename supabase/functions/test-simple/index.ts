import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('test-simple function started, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('test-simple function called');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const assistantId = Deno.env.get('ASSISTANT_ID');
    
    console.log('Secrets check:', {
      hasOpenaiKey: !!openAIApiKey,
      openaiKeyLength: openAIApiKey?.length || 0,
      hasAssistantId: !!assistantId,
      assistantIdLength: assistantId?.length || 0
    });

    const response = {
      success: true,
      message: 'Function working perfectly',
      timestamp: new Date().toISOString(),
      secrets: {
        hasOpenaiKey: !!openAIApiKey,
        hasAssistantId: !!assistantId
      }
    };

    console.log('Sending response:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-simple:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});