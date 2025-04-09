const express = require('express');
const { exec } = require('child_process');
const adb = require('adbkit');
const cors = require('cors');

const app = express();
app.use(cors());

const client = adb.createClient();

// Check if ADB device is connected
async function checkADBDevice() {
    try {
        const devices = await client.listDevices();
        return devices.length > 0;
    } catch (error) {
        console.error('ADB device check failed:', error);
        return false;
    }
}

// Stream camera from ADB device
app.get('/adb-camera', async (req, res) => {
    try {
        const hasDevice = await checkADBDevice();
        if (!hasDevice) {
            return res.status(404).json({ error: 'No ADB device connected' });
        }

        // Forward Android camera through ADB
        exec('adb forward tcp:5001 tcp:5001', async (error) => {
            if (error) {
                console.error('ADB forward failed:', error);
                return res.status(500).json({ error: 'Failed to forward ADB port' });
            }

            // Start camera stream on device
            await client.shell(devices[0].id, 'am start -n com.example.camerarelay/.MainActivity');
            
            // Return stream URL to client
            res.json({ streamUrl: 'http://localhost:5001/camera' });
        });
    } catch (error) {
        console.error('ADB camera stream failed:', error);
        res.status(500).json({ error: 'Failed to start camera stream' });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`ADB bridge running on port ${PORT}`);
});
