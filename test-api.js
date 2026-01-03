
// Native fetch

async function testApi() {
    try {
        const response = await fetch('http://localhost:3000/api/matches?status=UPCOMING'); // Assuming port 3000
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Is Array:', Array.isArray(data));
        if (!Array.isArray(data)) {
            console.log('Data:', JSON.stringify(data, null, 2));
        } else {
            console.log('First match:', JSON.stringify(data[0], null, 2));
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testApi();
