const express = require('express');

// Global error handlers
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	process.exit(1);
});

process.on('unhandledRejection', (error) => {
	console.error('Unhandled Rejection:', error);
	process.exit(1);
});

const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const winston = require('winston');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.File({ filename: 'combined.log' })
	]
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.simple()
	}));
}

// Middleware
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
			scriptSrcElem: ["'self'", "https://cdnjs.cloudflare.com"],
			styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
			fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
			imgSrc: ["'self'", "data:", "blob:"],
			connectSrc: ["'self'", "blob:"],
			mediaSrc: ["'self'", "mediastream:", "blob:"],
			workerSrc: ["'self'", "blob:"],
			childSrc: ["'self'", "blob:"],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			frameAncestors: ["'none'"],
			formAction: ["'self'"]
		}
	}
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/photos', express.static(path.join(__dirname, 'data', 'photos')));

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

// Ensure data directories exist
async function initializeDataDirectories() {
	try {
		await fs.mkdir(DATA_DIR, { recursive: true });
		await fs.mkdir(PHOTOS_DIR, { recursive: true });
		try {
			await fs.access(VISITORS_FILE);
			await fs.access(KEYS_FILE);
		} catch {
			await fs.writeFile(VISITORS_FILE, '[]');
			await fs.writeFile(KEYS_FILE, '[]');
		}
	} catch (error) {
		logger.error('Error initializing data directories:', error);
		throw error;
	}
}

// Helper functions
async function validateVisitorData(visitor) {
	// Validate required fields first
	const requiredFields = ['serialNumber', 'idNumber', 'name', 'company', 'phone', 'timeIn', 'date', 'purpose'];
	const missingFields = [];
	
	for (const field of requiredFields) {
		if (!visitor[field] || visitor[field].trim() === '') {
			missingFields.push(field);
		}
	}
	
	if (missingFields.length > 0) {
		throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
	}

	// Validate ID Number format
	const idPattern = /^784-\d{4}-\d{7}-\d$/;
	if (!idPattern.test(visitor.idNumber)) {
		throw new Error('Invalid ID Number format');
	}

	// Validate photos
	if (!visitor.frontPhoto || !visitor.backPhoto) {
		throw new Error('Both front and back ID photos are required');
	}

	return true;
}

async function loadVisitors() {
	try {
		const data = await fs.readFile(VISITORS_FILE, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		logger.error('Error loading visitors:', error);
		return [];
	}
}

async function saveVisitors(visitors) {
	try {
		await fs.writeFile(VISITORS_FILE, JSON.stringify(visitors, null, 2));
	} catch (error) {
		logger.error('Error saving visitors:', error);
		throw error;
	}
}

// API Routes
app.get('/api/visitors', async (req, res) => {
	try {
		const visitors = await loadVisitors();
		res.json(visitors);
	} catch (error) {
		logger.error('Error fetching visitors:', error);
		res.status(500).json({ error: 'Failed to fetch visitors' });
	}
});

app.post('/api/visitors', async (req, res) => {
	try {
		const visitor = req.body;
		
		// Validate visitor data
		await validateVisitorData(visitor);
		
		const visitors = await loadVisitors();
		
		// Ensure serial number is sequential
		const nextSerialNumber = (visitors.length + 1).toString().padStart(4, '0');
		visitor.serialNumber = nextSerialNumber;
		
		// Add current date
		visitor.date = new Date().toISOString().split('T')[0];
		
		// Save photos
		const frontPhotoPath = path.join(PHOTOS_DIR, `${visitor.serialNumber}_front.jpg`);
		const backPhotoPath = path.join(PHOTOS_DIR, `${visitor.serialNumber}_back.jpg`);
		
		// Convert base64 to files
		const frontPhotoData = visitor.frontPhoto.replace(/^data:image\/\w+;base64,/, '');
		const backPhotoData = visitor.backPhoto.replace(/^data:image\/\w+;base64,/, '');
		
		await fs.writeFile(frontPhotoPath, frontPhotoData, 'base64');
		await fs.writeFile(backPhotoPath, backPhotoData, 'base64');
		
		// Update photo paths in visitor data with absolute URLs
		visitor.frontPhoto = `/photos/${visitor.serialNumber}_front.jpg`;
		visitor.backPhoto = `/photos/${visitor.serialNumber}_back.jpg`;
		
		visitors.push(visitor);
		await saveVisitors(visitors);
		
		// Send success response with created visitor data
		res.status(201).json({
			success: true,
			message: 'Visitor created successfully',
			data: visitor
		});
	} catch (error) {
		logger.error('Error creating visitor:', error);
		// Send error response
		res.status(400).json({
			success: false,
			error: error.message || 'Failed to create visitor'
		});
	}
});

// Add timeout endpoint
app.post('/api/visitors/:serialNumber/timeout', async (req, res) => {
	try {
		const { serialNumber } = req.params;
		const { timeOut } = req.body;
		
		const visitors = await loadVisitors();
		const visitor = visitors.find(v => v.serialNumber === serialNumber);
		
		if (!visitor) {
			return res.status(404).json({ error: 'Visitor not found' });
		}
		
		visitor.timeOut = timeOut;
		await saveVisitors(visitors);
		
		// Return the updated visitor object
		res.json(visitor);
	} catch (error) {
		logger.error('Error recording timeout:', error);
		res.status(500).json({ error: 'Failed to record timeout' });
	}
});

app.delete('/api/visitors/:serialNumber', async (req, res) => {
	try {
		const { serialNumber } = req.params;
		const visitors = await loadVisitors();
		
		const visitorIndex = visitors.findIndex(v => v.serialNumber === serialNumber);
		if (visitorIndex === -1) {
			return res.status(404).json({ error: 'Visitor not found' });
		}
		
		// Delete photos
		const visitor = visitors[visitorIndex];
		const frontPhotoPath = path.join(PHOTOS_DIR, `${serialNumber}_front.jpg`);
		const backPhotoPath = path.join(PHOTOS_DIR, `${serialNumber}_back.jpg`);
		
		try {
			await fs.unlink(frontPhotoPath);
			await fs.unlink(backPhotoPath);
		} catch (error) {
			logger.error('Error deleting photos:', error);
		}
		
		visitors.splice(visitorIndex, 1);
		await saveVisitors(visitors);
		
		res.json({ message: 'Visitor deleted successfully' });
	} catch (error) {
		logger.error('Error deleting visitor:', error);
		res.status(500).json({ error: 'Failed to delete visitor' });
	}
});

// Delete visitor and adjust serial numbers
app.delete('/api/visitors/:serialNumber/adjust', async (req, res) => {
	try {
		const { serialNumber } = req.params;
		const visitors = await loadVisitors();
		
		const visitorIndex = visitors.findIndex(v => v.serialNumber === serialNumber);
		if (visitorIndex === -1) {
			return res.status(404).json({ error: 'Visitor not found' });
		}
		
		// Delete photos
		const visitor = visitors[visitorIndex];
		const frontPhotoPath = path.join(DATA_DIR, 'photos', `${serialNumber}_front.jpg`);
		const backPhotoPath = path.join(DATA_DIR, 'photos', `${serialNumber}_back.jpg`);
		
		// Remove the visitor first
		visitors.splice(visitorIndex, 1);
		
		// Delete photo files if they exist
		try {
			if (fs.existsSync(frontPhotoPath)) {
				await fs.unlink(frontPhotoPath);
			}
			if (fs.existsSync(backPhotoPath)) {
				await fs.unlink(backPhotoPath);
			}
		} catch (error) {
			logger.error('Error deleting photos:', error);
			// Continue with the process even if photo deletion fails
		}
		
		// Adjust serial numbers for remaining visitors
		for (let i = 0; i < visitors.length; i++) {
			const newSerial = (i + 1).toString().padStart(4, '0');
			const oldSerial = visitors[i].serialNumber;
			
			// Update visitor record
			visitors[i].serialNumber = newSerial;
			visitors[i].frontPhoto = `/photos/${newSerial}_front.jpg`;
			visitors[i].backPhoto = `/photos/${newSerial}_back.jpg`;
			
			// Rename photo files if they exist
			try {
				const oldFrontPath = path.join(DATA_DIR, 'photos', `${oldSerial}_front.jpg`);
				const oldBackPath = path.join(DATA_DIR, 'photos', `${oldSerial}_back.jpg`);
				const newFrontPath = path.join(DATA_DIR, 'photos', `${newSerial}_front.jpg`);
				const newBackPath = path.join(DATA_DIR, 'photos', `${newSerial}_back.jpg`);
				
				if (fs.existsSync(oldFrontPath)) {
					await fs.rename(oldFrontPath, newFrontPath);
				}
				if (fs.existsSync(oldBackPath)) {
					await fs.rename(oldBackPath, newBackPath);
				}
			} catch (error) {
				logger.error(`Error renaming photos for visitor ${oldSerial}:`, error);
				// Continue with the process even if renaming fails
			}
		}
		
		// Save the updated visitors list
		await saveVisitors(visitors);
		
		res.json({ 
			message: 'Visitor deleted and serial numbers adjusted',
			remainingCount: visitors.length 
		});
	} catch (error) {
		logger.error('Error in delete and adjust operation:', error);
		res.status(500).json({ 
			error: 'Failed to delete visitor and adjust serial numbers',
			details: error.message 
		});
	}
});




// Key management helper functions
async function validateKeyData(key) {
	const requiredFields = ['serialNumber', 'idNumber', 'name', 'keyTagName', 'timeTaken', 'date', 'securityRemarks'];
	const missingFields = [];
	
	for (const field of requiredFields) {
		if (!key[field] || key[field].trim() === '') {
			missingFields.push(field);
		}
	}
	
	if (missingFields.length > 0) {
		throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
	}

	// Validate ID Number format (784-XXXX-XXXXXXX-X)
	const idPattern = /^784-\d{4}-\d{7}-\d$/;
	if (!idPattern.test(key.idNumber)) {
		throw new Error('Invalid Emirates ID format. Expected format: 784-XXXX-XXXXXXX-X');
	}

	if (!key.frontPhoto || !key.backPhoto) {
		throw new Error('Both front and back ID photos are required');
	}

	return true;
}

async function loadKeys() {
    try {
        const data = await fs.readFile(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error('Error loading keys:', error);
        return [];
    }
}

async function saveKeys(keys) {
    try {
        await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2));
    } catch (error) {
        logger.error('Error saving keys:', error);
        throw error;
    }
}

// Dashboard stats route
app.get('/api/stats', async (req, res) => {
	try {
		const visitors = await loadVisitors();
		const keys = await loadKeys();
		const activeKeys = keys.filter(k => !k.timeReturned).length;

		res.json({
			totalVisitors: visitors.length,
			activeKeys: activeKeys
		});
	} catch (error) {
		logger.error('Error fetching stats:', error);
		res.status(500).json({ error: 'Failed to fetch stats' });
	}
});

// Key management routes
app.get('/api/keys', async (req, res) => {
    try {
        const keys = await loadKeys();
        res.json(keys);
    } catch (error) {
        logger.error('Error fetching keys:', error);
        res.status(500).json({ error: 'Failed to fetch keys' });
    }
});

app.post('/api/keys', async (req, res) => {
	try {
		const key = req.body;
		
		// Validate key data
		await validateKeyData(key);
		
		const keys = await loadKeys();
		
		// Ensure serial number is sequential
		const nextSerialNumber = (keys.length + 1).toString().padStart(4, '0');
		key.serialNumber = nextSerialNumber;
		
		// Add current date if not provided
		if (!key.date) {
			key.date = new Date().toISOString().split('T')[0];
		}
		
		// Save photos
		const frontPhotoPath = path.join(PHOTOS_DIR, `key_${key.serialNumber}_front.jpg`);
		const backPhotoPath = path.join(PHOTOS_DIR, `key_${key.serialNumber}_back.jpg`);
		
		// Convert base64 to files
		const frontPhotoData = key.frontPhoto.replace(/^data:image\/\w+;base64,/, '');
		const backPhotoData = key.backPhoto.replace(/^data:image\/\w+;base64,/, '');
		
		await fs.writeFile(frontPhotoPath, frontPhotoData, 'base64');
		await fs.writeFile(backPhotoPath, backPhotoData, 'base64');
		
		// Update photo paths in key data
		key.frontPhoto = `/photos/key_${key.serialNumber}_front.jpg`;
		key.backPhoto = `/photos/key_${key.serialNumber}_back.jpg`;
		
		keys.push(key);
		await saveKeys(keys);
		
		res.status(201).json({
			success: true,
			message: 'Key entry created successfully',
			data: key
		});
	} catch (error) {
		logger.error('Error creating key entry:', error);
		res.status(400).json({
			success: false,
			error: error.message || 'Failed to create key entry'
		});
	}
});

// Delete key endpoint with serial number adjustment
app.delete('/api/keys/:serialNumber', async (req, res) => {
	try {
		const { serialNumber } = req.params;
		const keys = await loadKeys();
		
		const keyIndex = keys.findIndex(k => k.serialNumber === serialNumber);
		if (keyIndex === -1) {
			return res.status(404).json({ error: 'Key not found' });
		}
		
		// Delete photos
		const key = keys[keyIndex];
		const frontPhotoPath = path.join(PHOTOS_DIR, `key_${serialNumber}_front.jpg`);
		const backPhotoPath = path.join(PHOTOS_DIR, `key_${serialNumber}_back.jpg`);
		
		// Remove the key first
		keys.splice(keyIndex, 1);
		
		// Delete photo files if they exist
		try {
			if (fs.existsSync(frontPhotoPath)) {
				await fs.unlink(frontPhotoPath);
			}
			if (fs.existsSync(backPhotoPath)) {
				await fs.unlink(backPhotoPath);
			}
		} catch (error) {
			logger.error('Error deleting key photos:', error);
		}
		
		// Adjust serial numbers for remaining keys
		for (let i = 0; i < keys.length; i++) {
			const newSerial = (i + 1).toString().padStart(4, '0');
			const oldSerial = keys[i].serialNumber;
			
			// Update key record
			keys[i].serialNumber = newSerial;
			keys[i].frontPhoto = `/photos/key_${newSerial}_front.jpg`;
			keys[i].backPhoto = `/photos/key_${newSerial}_back.jpg`;
			
			// Rename photo files if they exist
			try {
				const oldFrontPath = path.join(PHOTOS_DIR, `key_${oldSerial}_front.jpg`);
				const oldBackPath = path.join(PHOTOS_DIR, `key_${oldSerial}_back.jpg`);
				const newFrontPath = path.join(PHOTOS_DIR, `key_${newSerial}_front.jpg`);
				const newBackPath = path.join(PHOTOS_DIR, `key_${newSerial}_back.jpg`);
				
				if (fs.existsSync(oldFrontPath)) {
					await fs.rename(oldFrontPath, newFrontPath);
				}
				if (fs.existsSync(oldBackPath)) {
					await fs.rename(oldBackPath, newBackPath);
				}
			} catch (error) {
				logger.error(`Error renaming photos for key ${oldSerial}:`, error);
			}
		}
		
		await saveKeys(keys);
		
		res.json({ 
			message: 'Key record deleted and serial numbers adjusted',
			remainingCount: keys.length 
		});
	} catch (error) {
		logger.error('Error deleting key:', error);
		res.status(500).json({ error: 'Failed to delete key' });
	}
});

// Add key return endpoint 
app.post('/api/keys/:serialNumber/return', async (req, res) => {
	try {
		const { serialNumber } = req.params;
		const { timeReturned } = req.body;
		
		const keys = await loadKeys();
		const key = keys.find(k => k.serialNumber === serialNumber);
		
		if (!key) {
			return res.status(404).json({ error: 'Key not found' });
		}
		
		key.timeReturned = timeReturned;
		await saveKeys(keys);
		
		// Return the updated key object
		res.json(key);
	} catch (error) {
		logger.error('Error recording key return:', error);
		res.status(500).json({ error: 'Failed to record key return' });
	}
});


// Error handling middleware
app.use((err, req, res, next) => {
	logger.error(err.stack);
	res.status(500).send('Something broke!');
});

// Initialize data directories and start server
initializeDataDirectories()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
			logger.info(`Server is running on port ${PORT}`);
		});
	})
	.catch(error => {
		console.error('Failed to initialize server:', error);
		logger.error('Failed to initialize server:', error);
		process.exit(1);
	});