export const config = {
  runtime: 'edge',
};

const PIXEL_ID = '1639585477324656';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const payload = {
      data: [
        {
          event_name: body.event_name || 'PageView',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: {
            client_user_agent: body.user_agent || '',
            ...body.user_data
          },
          custom_data: body.custom_data || {},
        }
      ]
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('CAPI Error:', error);
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
}
