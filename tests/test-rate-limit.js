const axios = require('axios');

const config = {
    url: 'http://localhost:3000/api/test',
    requestsPerBatch: 50,    // Number of requests to send in each batch
    totalBatches: 3,         // Number of batches to send
    delayBetweenBatches: 2000 // Delay between batches in ms
};

// Helper to create a batch of requests
const createRequestBatch = async (batchNumber) => {
    console.log(`\n🚀 Starting batch ${batchNumber + 1}`);
    
    const requests = Array(config.requestsPerBatch).fill().map(async (_, index) => {
        try {
            const start = Date.now();
            const response = await axios.get(config.url);
            const duration = Date.now() - start;
            
            console.log(`✅ Request ${index + 1}: ${response.status} (${duration}ms)`);
            return { success: true, status: response.status };
        } catch (error) {
            if (error.response) {
                console.log(`❌ Request ${index + 1}: ${error.response.status} - Rate Limited`);
                return { success: false, status: error.response.status };
            }
            console.log(`❌ Request ${index + 1}: Failed - ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    const results = await Promise.all(requests);
    
    // Print batch statistics
    const successful = results.filter(r => r.success).length;
    const rateLimited = results.filter(r => !r.success && r.status === 429).length;
    const failed = results.filter(r => !r.success && r.status !== 429).length;
    
    console.log('\nBatch Statistics:');
    console.log(`✅ Successful: ${successful}`);
    console.log(`🚫 Rate Limited: ${rateLimited}`);
    console.log(`❌ Failed: ${failed}`);
    
    return results;
};


async function runTest() {
    console.log('🔥 Starting Rate Limit Test\n');
    
    for (let i = 0; i < config.totalBatches; i++) {
        await createRequestBatch(i);
        
        if (i < config.totalBatches - 1) {
            console.log(`\n⏳ Waiting ${config.delayBetweenBatches}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
        }
    }
    
    console.log('\n✨ Test Complete!');
}


runTest().catch(console.error);