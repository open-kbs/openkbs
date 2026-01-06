const Header = () => {
    const [status, setStatus] = React.useState(null);

    React.useEffect(() => {
        const fetchStatus = async () => {
            try {
                const [sleepUntil, pulseInterval] = await Promise.all([
                    openkbs.items({ action: 'getItem', itemId: 'agent_sleepUntil' }),
                    openkbs.items({ action: 'getItem', itemId: 'agent_pulseInterval' })
                ]);
                setStatus({
                    sleeping: sleepUntil?.item?.body?.value,
                    interval: pulseInterval?.item?.body?.value || 1
                });
            } catch (e) {}
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!status) return null;

    const isSleeping = status.sleeping && new Date(status.sleeping) > new Date();

    return (
        <div style={{
            padding: '8px 16px',
            background: isSleeping ? '#ff9800' : '#4caf50',
            color: 'white',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between'
        }}>
            <span>{isSleeping ? '😴 SLEEPING' : '🟢 ACTIVE'}</span>
            <span>Pulse: every {status.interval} min</span>
        </div>
    );
};

const onRenderChatMessage = (params) => {
    const { content } = params;

    // Try to parse as JSON
    let data;
    try {
        data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
        return null; // Use default rendering
    }

    // Handle command results
    if (data?.type) {
        const isError = data.type.includes('ERROR');
        return (
            <div style={{
                padding: '12px',
                margin: '8px 0',
                borderRadius: '8px',
                background: isError ? '#ffebee' : '#e8f5e9',
                border: `1px solid ${isError ? '#ef5350' : '#66bb6a'}`
            }}>
                <strong>{data.type}</strong>
                {data.error && <div style={{ color: '#c62828' }}>{data.error}</div>}
                {data.itemId && <div>Item: {data.itemId}</div>}
                {data.messageId && <div>Message ID: {data.messageId}</div>}
            </div>
        );
    }

    return null;
};

window.contentRender = { Header, onRenderChatMessage };
