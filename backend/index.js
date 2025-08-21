const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const multer = require('multer');
require('dotenv').config();
const fs = require('fs').promises;
const crypto = require("crypto")

const app = express();

// Enable compression for all routes (improves transfer speed)
app.use(compression({
    level: 6, // Good balance between compression ratio and speed
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
        // Don't compress file uploads
        if (req.url.includes('/upload')) return false;
        return compression.filter(req, res);
    }
}));

// Configure server for large file uploads
app.use((req, res, next) => {
    // Increase timeout for large file uploads (30 minutes)
    req.setTimeout(30 * 60 * 10000);
    res.setTimeout(30 * 60 * 10000);
    next();
});

const corsOptions = {
  origin: "*",
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Origin','Content-Type','Authorization','X-Requested-With','user','pass','id','upload-session-id'],
  exposedHeaders: ['Upload-Session-Id'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Middlewares
app.use(morgan('dev'));
// Configure CORS with specific options

app.use(express.json({ limit: '50000gb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50000gb', extended: true })); // Increase URL-encoded payload limit

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
async function createJsonFile(filePath, data, options = {}) {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    const json = JSON.stringify(data, null, options.spaces ?? 2);

    try {
        // 'wx' -> fail if exists
        const handle = await fs.open(filePath, 'wx');
        await handle.writeFile(json, 'utf8');
        await handle.close();
        return true; // created
    } catch (err) {
        // If file exists, just return false (no error)
        if (err && err.code === 'EEXIST') {
            return false; // ya existía
        }
        // Propaga otros errores
        throw err;
    }
}
async function readJsonFile(filePath) {
    const text = await fs.readFile(filePath, 'utf8');
    try {
        return JSON.parse(text);
    } catch (err) {
        const e = new Error(`Invalid JSON in ${filePath}: ${err.message}`);
        e.original = err;
        throw e;
    }
}

async function writeJsonFile(filePath, data, options = {}) {
    const { spaces = 2 } = options;
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    const tmpPath = `${filePath}.tmp-${Date.now()}`;
    const json = JSON.stringify(data, null, spaces);

    // Write to temp file then rename for atomic-ish write
    await fs.writeFile(tmpPath, json, 'utf8');
    await fs.rename(tmpPath, filePath);
}

async function updateJsonFile(filePath, updater, options = {}) {
    // Read existing (if not exists, treat as empty object)
    let current = {};
    try {
        current = await readJsonFile(filePath);
    } catch (err) {
        // If file not found, start with {}
        if (err.code === 'ENOENT') current = {};
        else throw err;
    }

    let updated;
    if (typeof updater === 'function') {
        updated = await updater(current);
    } else if (updater && typeof updater === 'object') {
        updated = { ...current, ...updater };
    } else {
        throw new Error('updater must be a function or an object');
    }

    await writeJsonFile(filePath, updated, options);
    return updated;
}

// Middleware para autenticación
async function authenticateUser(req, res, next) {
    const { user, pass, id } = req.headers;
    
    if (!user || !pass || !id) {
        return res.status(401).json({ message: 'Missing authentication headers' });
    }
    
    try {
        // Verify credentials against database
        const dataPath = path.join(__dirname, 'db.json');
        let db;
        
        try {
            db = await readJsonFile(dataPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(401).json({ message: 'Database not found' });
            }
            throw err;
        }
        
        // Normalize database structure (same logic as in other endpoints)
        if (Array.isArray(db)) {
            if (db.length > 0 && db[0] && Array.isArray(db[0].accounts)) {
                db = db[0];
            } else {
                db = { accounts: [] };
            }
        }
        if (db && db['0'] && Array.isArray(db['0'].accounts)) {
            db = db['0'];
        }
        if (!db || !Array.isArray(db.accounts)) {
            db = { accounts: [] };
        }
        
        // Find user by credentials
        const foundUser = db.accounts.find(account => 
            account.user === user && 
            account.pass === pass && 
            account.id === id
        );
        
        if (!foundUser) {
            console.log(`Authentication failed for user: ${user}, id: ${id}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        console.log(`Authentication successful for user: ${user}, id: ${id}`);
        
        // Store user info in request for later use
        req.userAuth = { user, pass, id };
        next();
        
    } catch (err) {
        console.error('Authentication error:', err);
        return res.status(500).json({ message: 'Internal server error during authentication' });
    }
}

// Configure multer for file uploads with disk storage for large files
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const { id: userId } = req.userAuth;
            const { path: requestedPath = '/' } = req.body;
            const userDir = getUserDirectory(userId);
            const targetDir = path.join(userDir, requestedPath);
            
            console.log(`Upload destination: ${targetDir}`);
            
            // Create directory if it doesn't exist
            ensureDir(targetDir)
                .then(() => {
                    console.log(`Directory ensured: ${targetDir}`);
                    cb(null, targetDir);
                })
                .catch(err => {
                    console.error(`Error creating directory ${targetDir}:`, err);
                    cb(err);
                });
        },
        filename: function (req, file, cb) {
            // Use original filename with timestamp to avoid conflicts
            const timestamp = Date.now();
            const originalName = file.originalname;
            const ext = path.extname(originalName);
            const nameWithoutExt = path.basename(originalName, ext);
            const uniqueName = `${nameWithoutExt}_${timestamp}${ext}`;
            
            console.log(`Original filename: ${originalName}, Unique filename: ${uniqueName}`);
            cb(null, originalName); // Use original name, let the system handle conflicts
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024 * 1024, // 50GB limit
        fieldSize: 25 * 1024 * 1024, // 25MB field size
        fields: 100,
        files: 100, // Max 100 files at once
        parts: 1000,
        headerPairs: 2000
    },
    fileFilter: (req, file, cb) => {
        console.log(`Multer processing file: ${file.originalname}, MIME type: ${file.mimetype}`);
        
        // Add basic file validation
        if (!file.originalname || file.originalname.trim() === '') {
            return cb(new Error('Invalid filename'), false);
        }
        
        // Check for dangerous file extensions (optional)
        const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (dangerousExts.includes(ext)) {
            console.log(`Rejected dangerous file type: ${ext}`);
            return cb(new Error(`File type ${ext} is not allowed`), false);
        }
        
        cb(null, true);
    },
});

// Optimized upload configuration for chunks (smaller limits for faster processing)
const chunkUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            // For chunks, use a temp directory
            const tempDir = path.join(__dirname, 'temp', 'chunks');
            ensureDir(tempDir)
                .then(() => cb(null, tempDir))
                .catch(err => cb(err));
        },
        filename: function (req, file, cb) {
            // Use a temporary name for chunks
            const tempName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            cb(null, tempName);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per chunk
        fieldSize: 1024, // Small field size for chunk metadata
        fields: 10,
        files: 1, // Only one chunk at a time
        parts: 20,
        headerPairs: 100
    }
});

// Helper function to get user directory
function getUserDirectory(userId) {
    return path.join(__dirname, userId);
}

// Helper function to create file metadata
function createFileMetadata(filePath, type, size = 0, isPublic = false) {
    const name = path.basename(filePath);
    const extension = type === 'file' ? path.extname(name).slice(1) : undefined;
    const now = new Date();
    
    return {
        id: crypto.randomUUID(),
        name,
        type,
        size,
        created: now,
        modified: now,
        path: filePath,
        extension,
        isPublic
    };
}

// Helper function to find file path by ID
async function findFilePathById(userDir, fileId) {
    console.log(`Searching for file ID: ${fileId} in directory: ${userDir}`);
    
    // Try to search in public-files.json first (for already public files)
    try {
        const publicMetadataPath = path.join(__dirname, 'public-files.json');
        let publicFiles = { files: [] };
        
        try {
            publicFiles = await readJsonFile(publicMetadataPath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Error reading public files metadata:', err);
            }
        }
        
        if (Array.isArray(publicFiles.files)) {
            const publicFile = publicFiles.files.find(f => f.id === fileId);
            if (publicFile && publicFile.path) {
                // Remove leading slash for relative path
                const relativePath = publicFile.path.startsWith('/') ? 
                    publicFile.path.substring(1) : publicFile.path;
                console.log(`Found file ID ${fileId} in public files registry: ${relativePath}`);
                return relativePath;
            }
        }
    } catch (error) {
        console.error('Error searching in public files registry:', error);
    }
    
    // If not found in public files, search the filesystem
    async function searchDirectory(currentPath) {
        try {
            const items = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const item of items) {
                if (item.name.startsWith('.')) continue; // Skip hidden files
                
                const itemPath = path.join(currentPath, item.name);
                const relativePath = path.relative(userDir, itemPath).replace(/\\/g, '/');
                
                try {
                    const stats = await fs.stat(itemPath);
                    
                    // Generate ID the same way as in the list files endpoint
                    const itemId = Buffer.from(`${relativePath}:${stats.mtime.getTime()}`).toString('base64');
                    
                    console.log(`Checking item: ${item.name}, relativePath: ${relativePath}, generated ID: ${itemId}`);
                    
                    if (itemId === fileId) {
                        console.log(`Found matching file: ${relativePath}`);
                        return relativePath;
                    }
                    
                    // If it's a directory, search recursively
                    if (item.isDirectory()) {
                        const found = await searchDirectory(itemPath);
                        if (found) return found;
                    }
                } catch (statError) {
                    console.error(`Error getting stats for ${itemPath}:`, statError);
                }
            }
        } catch (error) {
            console.error(`Error searching directory ${currentPath}:`, error);
        }
        return null;
    }
    
    const result = await searchDirectory(userDir);
    console.log(`Search result for ID ${fileId}: ${result}`);
    return result;
}

// Helper function to create file item with consistent ID generation
function createFileItemWithStats(name, filePath, stats, userDir, isPublic = false) {
    const extension = path.extname(name).slice(1);
    const type = stats.isDirectory() ? 'folder' : 'file';
    const relativePath = path.relative(userDir, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    // Use a consistent ID generation method
    const id = Buffer.from(`${normalizedPath}:${stats.mtime.getTime()}`).toString('base64');
    console.log(`Generated ID for ${normalizedPath}: ${id}`);
    
    return {
        id,
        name,
        type,
        size: type === 'folder' ? 0 : stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        path: '/' + normalizedPath,
        extension: type === 'file' ? extension : undefined,
        isPublic
    };
}
 

// Rutas básicas
app.get('/', async (req, res) => {
    const dataPath = path.join(__dirname, 'db.json');
    try {
        // Initialize DB as an object with an accounts array (not an array with index 0)
        await createJsonFile(dataPath, { accounts: [] });
    } catch (err) {
        // createJsonFile returns false if it already existed; any other error log it
        if (err && err.code !== 'EEXIST') console.error('Error ensuring db.json:', err);
    }
    res.json({ message: 'WarpFS backend running' });
});

app.post('/createUser', async (req, res) => {
    const getDataUser = req.body;
    if (!getDataUser || !getDataUser.user) {
        return res.status(400).json({ message: 'Missing user field' });
    }

    const dataPath = path.join(__dirname, 'db.json');
    try {
        // Read existing DB (if not exists start with object shape)
        let db;
        try {
            db = await readJsonFile(dataPath);
        } catch (err) {
            if (err.code === 'ENOENT') db = { accounts: [] };
            else throw err;
        }

        // Normalize possible shapes: array with index 0, object with "0" key, or already { accounts: [] }
        if (Array.isArray(db)) {
            if (db.length > 0 && db[0] && Array.isArray(db[0].accounts)) db = db[0];
            else db = { accounts: [] };
        }
        if (db && db['0'] && Array.isArray(db['0'].accounts)) {
            db = db['0'];
        }
        if (!db || !Array.isArray(db.accounts)) db = { accounts: [] };

        // Check duplicate by `user` field
        const exists = db.accounts.find(u => u.user === getDataUser.user);
        if (exists) {
            return res.status(409).json({ message: 'User already exists' });
        }

        // Generate a unique id for the new user. Prefer crypto.randomUUID(); fallback to randomBytes.
        let id;
        if (typeof crypto.randomUUID === 'function') {
            id = crypto.randomUUID();
        } else {
            id = crypto.randomBytes(16).toString('hex');
        }

        // Guard against (extremely unlikely) collisions
        while (db.accounts.find(u => u.id === id)) {
            if (typeof crypto.randomUUID === 'function') id = crypto.randomUUID();
            else id = crypto.randomBytes(16).toString('hex');
        }

        const newUser = { id, ...getDataUser };
        db.accounts.push(newUser);
        // Overwrite the file with the normalized shape
        await writeJsonFile(dataPath, db);
        
        // Create user directory
        const userDir = getUserDirectory(id);
        await ensureDir(userDir);
        
        // Create metadata file for the user's root directory
        const metadataPath = path.join(userDir, '.metadata.json');
        await writeJsonFile(metadataPath, { files: [] });
        
        console.log("User created successfully with directory:", userDir);
        res.status(201).json({ message: 'User created successfully', id });
    } catch (err) {
        console.error('createUser error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/logInUser', async (req, res) => {
    const { user, pass } = req.body || {};
    if (!user || !pass) return res.status(400).json({ message: 'Missing user or pass' });

    const dataPath = path.join(__dirname, 'db.json');
    try {
        let db;
        try {
            db = await readJsonFile(dataPath);
        } catch (err) {
            if (err.code === 'ENOENT') db = { accounts: [] };
            else throw err;
        }

        // Normalize shapes (same logic as createUser)
        if (Array.isArray(db)) {
            if (db.length > 0 && db[0] && Array.isArray(db[0].accounts)) db = db[0];
            else db = { accounts: [] };
        }
        if (db && db['0'] && Array.isArray(db['0'].accounts)) {
            db = db['0'];
        }
        if (!db || !Array.isArray(db.accounts)) db = { accounts: [] };

        const found = db.accounts.find(u => u.user === user && u.pass === pass);
        if (!found) return res.status(401).json({ message: 'Invalid credentials' });

        // Success (you might return a token here in future)
        return res.json({ message: 'User logged in successfully', userId: found.id });
    } catch (err) {
        console.error('logInUser error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// File system routes
app.get('/files', authenticateUser, async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const requestedPath = req.query.path || '/';
        const userDir = getUserDirectory(userId);
        const fullPath = path.join(userDir, requestedPath);
        
        // Ensure the path is within user directory (security check)
        if (!fullPath.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Read directory contents
        let items = [];
        
        // Read public files metadata to check which files are public
        const publicMetadataPath = path.join(__dirname, 'public-files.json');
        let publicFiles = { files: [] };
        
        try {
            publicFiles = await readJsonFile(publicMetadataPath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Error reading public files metadata:', err);
            }
        }
        
        if (!Array.isArray(publicFiles.files)) {
            publicFiles.files = [];
        }
        
        try {
            const dirContents = await fs.readdir(fullPath, { withFileTypes: true });
            
            for (const item of dirContents) {
                if (item.name.startsWith('.')) continue; // Skip hidden files
                
                const itemPath = path.join(fullPath, item.name);
                const stats = await fs.stat(itemPath);
                const relativePath = path.relative(userDir, itemPath).replace(/\\/g, '/');
                
                // Create consistent file item with stats-based ID
                const fileId = Buffer.from(`${relativePath}:${stats.mtime.getTime()}`).toString('base64');
                
                // Check if this file is in the public files list (only files can be public now)
                // We need to match by both ID and path to ensure accuracy
                const isPublic = publicFiles.files.some(publicFile => {
                    const matches = publicFile.id === fileId && publicFile.userId === userId;
                    if (matches) {
                        console.log(`Found public file match: ${fileId} -> ${relativePath}`);
                    }
                    return matches;
                });
                
                const fileItem = {
                    id: fileId,
                    name: item.name,
                    type: item.isDirectory() ? 'folder' : 'file',
                    size: item.isDirectory() ? 0 : stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    path: '/' + relativePath,
                    extension: !item.isDirectory() ? path.extname(item.name).slice(1) : undefined,
                    isPublic: isPublic
                };
                
                items.push(fileItem);
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Directory doesn't exist, create it
                await ensureDir(fullPath);
                items = [];
            } else {
                throw err;
            }
        }
        
        res.json({ data: items });
    } catch (err) {
        console.error('Error listing files:', err);
        res.status(500).json({ message: 'Failed to list files' });
    }
});

app.post('/files', authenticateUser, async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const { name, path: requestedPath, type, content = '' } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({ message: 'Missing name or type' });
        }
        
        const userDir = getUserDirectory(userId);
        const dirPath = path.join(userDir, requestedPath || '/');
        const fullPath = path.join(dirPath, name);
        
        // Security check
        if (!fullPath.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Ensure directory exists
        await ensureDir(dirPath);
        
        if (type === 'folder') {
            await ensureDir(fullPath);
        } else {
            await fs.writeFile(fullPath, content, 'utf8');
        }
        
        const stats = await fs.stat(fullPath);
        const relativePath = path.relative(userDir, fullPath).replace(/\\/g, '/');
        
        const fileItem = createFileMetadata(
            '/' + relativePath,
            type,
            type === 'file' ? stats.size : 0
        );
        
        fileItem.created = stats.birthtime;
        fileItem.modified = stats.mtime;
        
        res.status(201).json({ data: fileItem });
    } catch (err) {
        console.error('Error creating file/folder:', err);
        res.status(500).json({ message: 'Failed to create file/folder' });
    }
});


// Store upload progress for each session
const uploadProgress = new Map();

// Middleware to track upload progress - modified to not interfere with multer
function trackUploadProgress(req, res, next) {
    if (req.method === 'POST' && req.url === '/upload') {
        const sessionId = req.headers['upload-session-id'] || crypto.randomUUID();
        const contentLength = parseInt(req.headers['content-length'] || '0');
        
        const startTime = Date.now();
        
        // Initialize progress tracking
        uploadProgress.set(sessionId, {
            totalSize: contentLength,
            uploadedSize: 0,
            startTime,
            lastUpdateTime: startTime,
            speed: 0,
            estimatedTimeLeft: 0,
            percentage: 0,
            status: 'uploading'
        });
        
        req.uploadSessionId = sessionId;
        
        // Set session ID in response headers
        res.setHeader('Upload-Session-Id', sessionId);
        
        // Track progress using a different approach that doesn't interfere with multer
        let uploadedSize = 0;
        const originalOn = req.on.bind(req);
        
        // Override the 'on' method to intercept 'data' events without consuming them
        req.on = function(event, handler) {
            if (event === 'data') {
                const wrappedHandler = function(chunk) {
                    uploadedSize += chunk.length;
                    const currentTime = Date.now();
                    const elapsedTime = (currentTime - startTime) / 1000;
                    
                    if (elapsedTime > 0) {
                        const speed = uploadedSize / elapsedTime;
                        const remainingBytes = contentLength - uploadedSize;
                        const estimatedTimeLeft = remainingBytes / speed;
                        const percentage = (uploadedSize / contentLength) * 100;
                        
                        uploadProgress.set(sessionId, {
                            totalSize: contentLength,
                            uploadedSize,
                            startTime,
                            lastUpdateTime: currentTime,
                            speed: speed / (1024 * 1024),
                            estimatedTimeLeft,
                            percentage: Math.min(percentage, 100),
                            status: 'uploading'
                        });
                        
                        // Log progress every 5% or every 5 seconds
                        if (percentage % 5 < 1 || currentTime - (uploadProgress.get(sessionId).lastLogTime || 0) > 5000) {
                            console.log(`Upload progress [${sessionId}]: ${percentage.toFixed(1)}% - ${(speed / (1024 * 1024)).toFixed(2)} MB/s - ETA: ${Math.round(estimatedTimeLeft)}s`);
                            const progress = uploadProgress.get(sessionId);
                            progress.lastLogTime = currentTime;
                        }
                    }
                    
                    return handler.call(this, chunk);
                };
                return originalOn('data', wrappedHandler);
            }
            return originalOn(event, handler);
        };
        
        req.on('end', () => {
            const progress = uploadProgress.get(sessionId);
            if (progress) {
                uploadProgress.set(sessionId, {
                    ...progress,
                    status: 'processing',
                    percentage: 100
                });
                console.log(`Upload completed [${sessionId}]`);
            }
        });
        
        req.on('error', (error) => {
            const progress = uploadProgress.get(sessionId);
            if (progress) {
                uploadProgress.set(sessionId, {
                    ...progress,
                    status: 'error',
                    error: error.message
                });
            }
        });
    }
    next();
}

// Apply the tracking middleware before multer
app.use('/upload', trackUploadProgress);

// Endpoint to get upload progress
app.get('/api/upload-progress/:sessionId', authenticateUser, (req, res) => {
    const { sessionId } = req.params;
    const progress = uploadProgress.get(sessionId);
    
    if (!progress) {
        return res.status(404).json({ 
            message: 'Upload session not found',
            sessionId 
        });
    }
    
    // Clean up completed or errored uploads after 5 minutes
    const now = Date.now();
    if (progress.status === 'completed' || progress.status === 'error') {
        if (now - progress.lastUpdateTime > 5 * 60 * 1000) {
            uploadProgress.delete(sessionId);
        }
    }
    
    res.json({
        sessionId,
        ...progress,
        totalSizeMB: (progress.totalSize / (1024 * 1024)).toFixed(2),
        uploadedSizeMB: (progress.uploadedSize / (1024 * 1024)).toFixed(2),
        speedMBps: progress.speed.toFixed(2),
        estimatedTimeLeftFormatted: formatTime(progress.estimatedTimeLeft)
    });
});

// Helper function to format time
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity || seconds < 0) {
        return 'Calculating...';
    }
    
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// Helper function to clean up temp directory after uploads
async function cleanupTempDirectory() {
    try {
        const tempDir = path.join(__dirname, 'temp');
        console.log('Cleaning up temp directory:', tempDir);
        
        // Check if temp directory exists
        try {
            await fs.access(tempDir);
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log('Temp directory cleaned up successfully');
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Error cleaning up temp directory:', err);
            }
            // If directory doesn't exist, that's fine - nothing to clean
        }
    } catch (err) {
        console.error('Error in cleanupTempDirectory:', err);
    }
}

// Store chunk sessions
const chunkSessions = new Map();

// Initialize chunked upload session
app.post('/upload-chunked/init', authenticateUser, async (req, res) => {
    try {
        const { fileName, fileSize, totalChunks, chunkSize, sessionId, path: requestedPath = '/' } = req.body;
        const { id: userId } = req.userAuth;
        
        if (!fileName || !fileSize || !totalChunks || !sessionId) {
            return res.status(400).json({ message: 'Missing required fields for chunked upload' });
        }
        
        const userDir = getUserDirectory(userId);
        const targetDir = path.join(userDir, requestedPath);
        
        // Security check
        if (!targetDir.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        await ensureDir(targetDir);
        
        // Create temporary directory for chunks
        const tempDir = path.join(__dirname, 'temp', sessionId);
        await ensureDir(tempDir);
        
        const session = {
            sessionId,
            fileName,
            fileSize,
            totalChunks,
            chunkSize,
            userId,
            targetDir,
            tempDir,
            receivedChunks: new Set(),
            startTime: Date.now(),
            lastUpdate: Date.now()
        };
        
        chunkSessions.set(sessionId, session);
        
        console.log(`Chunked upload initialized: ${fileName} (${Math.round(fileSize / 1024 / 1024)}MB, ${totalChunks} chunks)`);
        
        res.json({ message: 'Chunked upload session initialized', sessionId });
    } catch (err) {
        console.error('Error initializing chunked upload:', err);
        res.status(500).json({ message: 'Failed to initialize chunked upload' });
    }
});

// Upload individual chunk
app.post('/upload-chunked/chunk', authenticateUser, chunkUpload.single('chunk'), async (req, res) => {
    try {
        const { sessionId, chunkIndex } = req.body;
        const { id: userId } = req.userAuth;
        const chunk = req.file;
        
        if (!sessionId || chunkIndex === undefined || !chunk) {
            return res.status(400).json({ message: 'Missing chunk data' });
        }
        
        const session = chunkSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ message: 'Upload session not found' });
        }
        
        if (session.userId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const chunkIndexNum = parseInt(chunkIndex);
        const chunkPath = path.join(session.tempDir, `chunk_${chunkIndexNum.toString().padStart(6, '0')}`);
        
        // Move chunk to temp directory
        await fs.rename(chunk.path, chunkPath);
        
        session.receivedChunks.add(chunkIndexNum);
        session.lastUpdate = Date.now();
        
        console.log(`Chunk ${chunkIndexNum}/${session.totalChunks - 1} received for ${session.fileName}`);
        
        res.json({ 
            message: 'Chunk uploaded successfully', 
            chunkIndex: chunkIndexNum,
            totalReceived: session.receivedChunks.size,
            totalExpected: session.totalChunks
        });
    } catch (err) {
        console.error('Error uploading chunk:', err);
        res.status(500).json({ message: 'Failed to upload chunk' });
    }
});

// Finalize chunked upload - combine chunks
app.post('/upload-chunked/finalize', authenticateUser, async (req, res) => {
    const { sessionId, fileName, totalChunks } = req.body;
    const { id: userId } = req.userAuth;
    
    try {
        if (!sessionId || !fileName || !totalChunks) {
            return res.status(400).json({ message: 'Missing finalization data' });
        }
        
        const session = chunkSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ message: 'Upload session not found' });
        }
        
        if (session.userId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if all chunks are received
        if (session.receivedChunks.size !== session.totalChunks) {
            return res.status(400).json({ 
                message: 'Missing chunks', 
                received: session.receivedChunks.size,
                expected: session.totalChunks 
            });
        }
        
        const finalFilePath = path.join(session.targetDir, fileName);
        
        // Handle filename conflicts
        let finalPath = finalFilePath;
        let counter = 1;
        
        while (true) {
            try {
                await fs.access(finalPath);
                const ext = path.extname(fileName);
                const nameWithoutExt = path.basename(fileName, ext);
                const newName = `${nameWithoutExt} (${counter})${ext}`;
                finalPath = path.join(session.targetDir, newName);
                counter++;
            } catch {
                break;
            }
        }
        
        console.log(`Combining ${session.totalChunks} chunks for ${fileName}`);
        
        // Combine chunks using streams for better memory management
        const writeStream = require('fs').createWriteStream(finalPath);
        
        try {
            for (let i = 0; i < session.totalChunks; i++) {
                const chunkPath = path.join(session.tempDir, `chunk_${i.toString().padStart(6, '0')}`);
                console.log(`Processing chunk ${i}: ${chunkPath}`);
                
                // Check if chunk exists
                try {
                    await fs.access(chunkPath);
                } catch (chunkErr) {
                    throw new Error(`Chunk ${i} not found: ${chunkPath}`);
                }
                
                const chunkData = await fs.readFile(chunkPath);
                
                // Write chunk data synchronously to maintain order
                await new Promise((resolve, reject) => {
                    writeStream.write(chunkData, (err) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                });
            }
            
            // Close the write stream
            await new Promise((resolve, reject) => {
                writeStream.end((err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
            
        } catch (writeError) {
            // Close stream on error
            writeStream.destroy();
            throw writeError;
        }
        
        // Verify the final file was created successfully
        const stats = await fs.stat(finalPath);
        console.log(`Final file created: ${finalPath} (${stats.size} bytes)`);
        
        // Clean up temp directory
        try {
            console.log(`Cleaning up temp directory: ${session.tempDir}`);
            await fs.rm(session.tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error('Error cleaning up temp directory:', cleanupErr);
        }

        // Also clean up entire temp directory to remove any orphaned files
        await cleanupTempDirectory();
        
        // Generate file response
        const relativePath = path.relative(getUserDirectory(userId), finalPath).replace(/\\/g, '/');
        const fileId = Buffer.from(`${relativePath}:${stats.mtime.getTime()}`).toString('base64');
        
        const fileItem = {
            id: fileId,
            name: path.basename(finalPath),
            type: 'file',
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            path: '/' + relativePath,
            extension: path.extname(finalPath).slice(1),
            isPublic: false
        };
        
        // Clean up session
        chunkSessions.delete(sessionId);
        
        console.log(`Chunked upload completed successfully: ${fileName} -> ${path.basename(finalPath)} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        
        res.json({ 
            message: 'File uploaded successfully via chunked upload',
            data: fileItem
        });
        
    } catch (err) {
        console.error('Error finalizing chunked upload:', err);
        
        // Clean up on error - use the sessionId from the request body
        try {
            const session = chunkSessions.get(sessionId);
            if (session && session.tempDir) {
                console.log(`Cleaning up temp directory after error: ${session.tempDir}`);
                await fs.rm(session.tempDir, { recursive: true, force: true });
            }
            chunkSessions.delete(sessionId);
        } catch (cleanupErr) {
            console.error('Error cleaning up after error:', cleanupErr);
        }

        // Also clean up entire temp directory to remove any orphaned files
        await cleanupTempDirectory();
        
        res.status(500).json({ 
            message: 'Failed to finalize chunked upload',
            error: err.message 
        });
    }
});

// Cancel chunked upload session
app.delete('/upload-chunked/cancel/:sessionId', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { id: userId } = req.userAuth;
        
        const session = chunkSessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ message: 'Upload session not found' });
        }
        
        if (session.userId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        console.log(`Cancelling chunked upload session: ${sessionId} for file: ${session.fileName}`);
        
        // Clean up temp directory
        try {
            if (session.tempDir) {
                await fs.rm(session.tempDir, { recursive: true, force: true });
                console.log(`Temp directory cleaned up: ${session.tempDir}`);
            }
        } catch (cleanupErr) {
            console.error('Error cleaning up temp directory:', cleanupErr);
        }
        
        // Remove session
        chunkSessions.delete(sessionId);
        
        // Also clean up regular upload progress if it exists
        if (uploadProgress.has(sessionId)) {
            uploadProgress.delete(sessionId);
        }

        // Clean up entire temp directory to remove any orphaned files
        await cleanupTempDirectory();

        res.json({ message: 'Upload session cancelled successfully' });
    } catch (err) {
        console.error('Error cancelling chunked upload:', err);
        res.status(500).json({ message: 'Failed to cancel upload session' });
    }
});

// Clean up stale chunk sessions (run periodically)
setInterval(() => {
    const now = Date.now();
    const STALE_TIME = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of chunkSessions) {
        if (now - session.lastUpdate > STALE_TIME) {
            console.log(`Cleaning up stale chunk session: ${sessionId}`);
            
            // Clean up temp directory
            fs.rm(session.tempDir, { recursive: true, force: true })
                .catch(err => console.error('Error cleaning up stale session:', err));
            
            chunkSessions.delete(sessionId);
        }
    }

    // Also perform a general temp directory cleanup
    cleanupTempDirectory().catch(err => 
        console.error('Error in periodic temp cleanup:', err)
    );
}, 10 * 60 * 1000); // Check every 10 minutes

app.post('/upload', authenticateUser, upload.array('files'), async (req, res) => {
    try {
        console.log('Upload request received');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        console.log('Files:', req.files);
        
        const { id: userId } = req.userAuth;
        const { path: requestedPath = '/' } = req.body;
        const files = req.files;
        
        console.log('User ID:', userId);
        console.log('Requested path:', requestedPath);
        console.log('Files count:', files ? files.length : 0);
        
        if (!files || files.length === 0) {
            console.log('No files uploaded');
            return res.status(400).json({ message: 'No files uploaded' });
        }
        
        const userDir = getUserDirectory(userId);
        const uploadedFiles = [];
        
        for (const file of files) {
            try {
                console.log('Processing file:', file.originalname, 'Size:', file.size);
                console.log('File saved at:', file.path);
                
                // Check if file was actually saved
                try {
                    await fs.access(file.path);
                } catch (accessErr) {
                    console.error(`File not accessible: ${file.path}`, accessErr);
                    continue;
                }
                
                // Get file stats from the saved file
                const stats = await fs.stat(file.path);
                const relativePath = path.relative(userDir, file.path).replace(/\\/g, '/');
                
                // Check for file name conflicts and resolve them
                let finalPath = file.path;
                let finalName = file.originalname;
                let counter = 1;
                
                while (true) {
                    try {
                        const existingStats = await fs.stat(finalPath);
                        // File exists, create a new name
                        const ext = path.extname(file.originalname);
                        const nameWithoutExt = path.basename(file.originalname, ext);
                        finalName = `${nameWithoutExt} (${counter})${ext}`;
                        finalPath = path.join(path.dirname(file.path), finalName);
                        counter++;
                    } catch {
                        // File doesn't exist, we can use this name
                        break;
                    }
                }
                
                // Rename if necessary
                if (finalPath !== file.path) {
                    await fs.rename(file.path, finalPath);
                    console.log(`Renamed file from ${file.path} to ${finalPath}`);
                }
                
                // Get final stats
                const finalStats = await fs.stat(finalPath);
                const finalRelativePath = path.relative(userDir, finalPath).replace(/\\/g, '/');
                
                // Generate consistent file ID
                const fileId = Buffer.from(`${finalRelativePath}:${finalStats.mtime.getTime()}`).toString('base64');
                
                const fileItem = {
                    id: fileId,
                    name: finalName,
                    type: 'file',
                    size: finalStats.size,
                    created: finalStats.birthtime,
                    modified: finalStats.mtime,
                    path: '/' + finalRelativePath,
                    extension: path.extname(finalName).slice(1),
                    isPublic: false
                };
                
                uploadedFiles.push(fileItem);
                console.log('File processed successfully:', finalName);
                
            } catch (fileErr) {
                console.error('Error processing file:', file.originalname, fileErr);
                // Clean up the file if there was an error
                try {
                    if (file.path) {
                        await fs.unlink(file.path);
                    }
                } catch (unlinkErr) {
                    console.error('Error cleaning up file:', unlinkErr);
                }
            }
        }
        
        if (uploadedFiles.length === 0) {
            return res.status(500).json({ message: 'No files were successfully uploaded' });
        }
        
        // Update session status to completed
        const sessionId = req.uploadSessionId;
        if (sessionId && uploadProgress.has(sessionId)) {
            uploadProgress.set(sessionId, {
                ...uploadProgress.get(sessionId),
                status: 'completed',
                percentage: 100
            });
        }

        // Clean up any temporary files from temp directory
        await cleanupTempDirectory();

        res.status(201).json({ 
            message: `${uploadedFiles.length} file(s) uploaded successfully`,
            data: uploadedFiles,
            sessionId: sessionId
        });
    } catch (err) {
        console.error('Error uploading files:', err);
        res.status(500).json({ message: 'Failed to upload files' });
    }
});

// Upload folder endpoint (handle folder structure)
app.post('/upload-folder', authenticateUser, upload.array('files'), async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const { path: requestedPath = '/', folderStructure } = req.body;
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }
        
        const userDir = getUserDirectory(userId);
        const targetDir = path.join(userDir, requestedPath);
        
        // Security check
        if (!targetDir.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const uploadedFiles = [];
        let folderPaths;
        
        try {
            folderPaths = JSON.parse(folderStructure || '[]');
        } catch {
            folderPaths = [];
        }
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = folderPaths[i] || file.originalname;
            const fullFilePath = path.join(targetDir, relativePath);
            
            // Ensure the directory structure exists
            const fileDir = path.dirname(fullFilePath);
            await ensureDir(fileDir);
            
            // Write file to disk
            await fs.writeFile(fullFilePath, file.buffer);
            
            const stats = await fs.stat(fullFilePath);
            const relativeToUser = path.relative(userDir, fullFilePath).replace(/\\/g, '/');
            
            const fileItem = createFileMetadata(
                '/' + relativeToUser,
                'file',
                stats.size
            );
            
            fileItem.created = stats.birthtime;
            fileItem.modified = stats.mtime;
            
            uploadedFiles.push(fileItem);
        }

        // Clean up any temporary files from temp directory
        await cleanupTempDirectory();
        
        res.status(201).json({ 
            message: `Folder uploaded successfully with ${uploadedFiles.length} file(s)`,
            data: uploadedFiles 
        });
    } catch (err) {
        console.error('Error uploading folder:', err);
        res.status(500).json({ message: 'Failed to upload folder' });
    }
});

app.delete('/files', authenticateUser, async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const { ids } = req.body;
        
        if (!Array.isArray(ids)) {
            return res.status(400).json({ message: 'ids must be an array' });
        }
        
        const userDir = getUserDirectory(userId);
        const deletedIds = [];
        
        for (const fileId of ids) {
            console.log(`Attempting to delete file with ID: ${fileId}`);
            // Find file by ID in the directory structure
            const filePath = await findFilePathById(userDir, fileId);
            console.log(`Found file path for ID ${fileId}: ${filePath}`);
            
            if (filePath) {
                const fullPath = path.join(userDir, filePath);
                console.log(`Full path to delete: ${fullPath}`);
                
                try {
                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) {
                        console.log(`Deleting directory: ${fullPath}`);
                        await fs.rm(fullPath, { recursive: true, force: true });
                    } else {
                        console.log(`Deleting file: ${fullPath}`);
                        await fs.unlink(fullPath);
                    }
                    deletedIds.push(fileId);
                    console.log(`Successfully deleted: ${fullPath}`);
                } catch (deleteErr) {
                    console.error(`Error deleting file ${fileId}:`, deleteErr);
                }
            } else {
                console.log(`File with ID ${fileId} not found in directory structure`);
            }
        }
        
        res.status(200).json({ 
            message: `${deletedIds.length} files deleted successfully`,
            deletedIds 
        });
    } catch (err) {
        console.error('Error deleting files:', err);
        res.status(500).json({ message: 'Failed to delete files' });
    }
});

app.put('/files/move', authenticateUser, async (req, res) => {
    try {
        const { ids, destinationPath } = req.body;
        
        if (!Array.isArray(ids) || !destinationPath) {
            return res.status(400).json({ message: 'Missing ids or destinationPath' });
        }
        
        // Implementation for moving files would go here
        res.status(200).json({ message: 'Files moved successfully' });
    } catch (err) {
        console.error('Error moving files:', err);
        res.status(500).json({ message: 'Failed to move files' });
    }
});

app.put('/files/:id/rename', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const { id: userId } = req.userAuth;
        
        console.log(`Rename request - File ID: ${id}, New name: ${name}, User ID: ${userId}`);
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Missing or empty name' });
        }
        
        // Validate filename (avoid dangerous characters)
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
        if (dangerousChars.test(name)) {
            return res.status(400).json({ message: 'Filename contains invalid characters' });
        }
        
        const userDir = getUserDirectory(userId);
        const filePath = await findFilePathById(userDir, id);
        
        console.log(`Found file path: ${filePath}`);
        
        if (!filePath) {
            console.log(`File not found for ID: ${id}`);
            return res.status(404).json({ message: 'File not found' });
        }
        
        const oldFullPath = path.join(userDir, filePath);
        const dirPath = path.dirname(oldFullPath);
        const newFullPath = path.join(dirPath, name.trim());
        
        console.log(`Renaming from: ${oldFullPath} to: ${newFullPath}`);
        
        // Security check
        if (!newFullPath.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if new name already exists
        try {
            await fs.access(newFullPath);
            return res.status(400).json({ message: 'A file with this name already exists' });
        } catch {
            // File doesn't exist, we can proceed
        }
        
        // Check if source file exists
        try {
            await fs.access(oldFullPath);
        } catch {
            return res.status(404).json({ message: 'Source file not found' });
        }
        
        // Perform the rename operation
        await fs.rename(oldFullPath, newFullPath);
        console.log(`File renamed successfully from ${oldFullPath} to ${newFullPath}`);
        
        // Update public files registry if the file was public
        try {
            const publicMetadataPath = path.join(__dirname, 'public-files.json');
            let publicFiles = { files: [] };
            
            try {
                publicFiles = await readJsonFile(publicMetadataPath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error('Error reading public files metadata:', err);
                }
            }
            
            if (Array.isArray(publicFiles.files)) {
                const publicFileIndex = publicFiles.files.findIndex(f => f.id === id);
                if (publicFileIndex !== -1) {
                    // Update the public file entry
                    const stats = await fs.stat(newFullPath);
                    const newFileItem = createFileItemWithStats(name.trim(), newFullPath, stats, userDir, true);
                    newFileItem.userId = userId;
                    newFileItem.fullPath = newFullPath;
                    publicFiles.files[publicFileIndex] = newFileItem;
                    await writeJsonFile(publicMetadataPath, publicFiles);
                    console.log('Updated public file registry after rename');
                }
            }
        } catch (publicErr) {
            console.error('Error updating public files registry:', publicErr);
            // Don't fail the rename operation for this
        }
        
        // Return updated file information
        const stats = await fs.stat(newFullPath);
        const newFileItem = createFileItemWithStats(name.trim(), newFullPath, stats, userDir);
        
        res.status(200).json({ 
            message: 'File renamed successfully',
            data: newFileItem
        });
    } catch (err) {
        console.error('Error renaming file:', err);
        res.status(500).json({ message: `Failed to rename file: ${err.message}` });
    }
});

// Toggle public/private status of files
app.put('/files/:id/public', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublic } = req.body;
        const { id: userId } = req.userAuth;
        
        if (typeof isPublic !== 'boolean') {
            return res.status(400).json({ message: 'isPublic must be a boolean value' });
        }
        
        const userDir = getUserDirectory(userId);
        const filePath = await findFilePathById(userDir, id);
        
        if (!filePath) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        const fullPath = path.join(userDir, filePath);
        const stats = await fs.stat(fullPath);
        const fileName = path.basename(fullPath);
        
        // Read or create metadata file for public files
        const publicMetadataPath = path.join(__dirname, 'public-files.json');
        let publicFiles = { files: [] };
        
        try {
            publicFiles = await readJsonFile(publicMetadataPath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
        
        if (!Array.isArray(publicFiles.files)) {
            publicFiles.files = [];
        }
        
        const fileIndex = publicFiles.files.findIndex(f => {
            const matches = f.id === id && f.userId === userId;
            if (matches) {
                console.log('Found existing public file:', { id, userId, filePath: f.path });
            }
            return matches;
        });
        
        // Only allow files to be made public, not folders
        if (stats.isDirectory()) {
            return res.status(400).json({ message: 'Folders cannot be made public. Only individual files can be made public.' });
        }
        
        if (isPublic) {
            const fileItem = createFileItemWithStats(fileName, fullPath, stats, userDir, true);
            fileItem.userId = userId;
            fileItem.fullPath = fullPath;
            
            console.log('Making file public:', {
                id: fileItem.id,
                name: fileName,
                path: fileItem.path,
                relativePath: path.relative(userDir, fullPath),
                userId: userId
            });
            
            if (fileIndex === -1) {
                publicFiles.files.push(fileItem);
                console.log('Added new public file to list');
            } else {
                publicFiles.files[fileIndex] = fileItem;
                console.log('Updated existing public file in list');
            }
        } else {
            if (fileIndex !== -1) {
                console.log('Removing file from public list:', id);
                publicFiles.files.splice(fileIndex, 1);
            } else {
                console.log('File was not in public list:', id);
            }
        }
        
        await writeJsonFile(publicMetadataPath, publicFiles);
        
        // Return updated file information
        const updatedFileItem = createFileItemWithStats(fileName, fullPath, stats, userDir, isPublic);
        
        res.status(200).json({ 
            message: `File ${isPublic ? 'made public' : 'made private'} successfully`,
            data: updatedFileItem
        });
    } catch (err) {
        console.error('Error updating file public status:', err);
        res.status(500).json({ message: 'Failed to update file public status' });
    }
});

// Public file access endpoint (no authentication required)
app.get('/public/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        
        const publicMetadataPath = path.join(__dirname, 'public-files.json');
        let publicFiles = { files: [] };
        
        try {
            publicFiles = await readJsonFile(publicMetadataPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ message: 'File not found' });
            }
            throw err;
        }
        
        if (!Array.isArray(publicFiles.files)) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        const publicFile = publicFiles.files.find(f => f.id === fileId);
        
        if (!publicFile) {
            return res.status(404).json({ message: 'File not found or not public' });
        }
        
        // Check if file still exists
        try {
            const stats = await fs.stat(publicFile.fullPath);
            if (stats.isFile()) {
                const fileName = path.basename(publicFile.fullPath);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.sendFile(path.resolve(publicFile.fullPath));
            } else {
                res.status(400).json({ message: 'Path is not a file' });
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File was deleted, remove from public files
                publicFiles.files = publicFiles.files.filter(f => f.id !== fileId);
                await writeJsonFile(publicMetadataPath, publicFiles);
                res.status(404).json({ message: 'File not found' });
            } else {
                console.error('Error serving public file:', err);
                res.status(500).json({ message: 'Failed to serve file' });
            }
        }
    } catch (err) {
        console.error('Error serving public file:', err);
        res.status(500).json({ message: 'Failed to serve public file' });
    }
});

// API to serve raw file content
app.post('/raw-file', authenticateUser, async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const { path: filePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ message: 'Missing path' });
        }
        
        const userDir = getUserDirectory(userId);
        const fullPath = path.join(userDir, filePath.replace(/^\/+/, ''));
        
        // Security check: ensure file is within user directory
        if (!fullPath.startsWith(userDir)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        // Check if file exists
        try {
            const stats = await fs.stat(fullPath);
            
            if (stats.isDirectory()) {
                return res.status(400).json({ message: 'Cannot serve directory content' });
            }
            
            // Get file extension to determine content type
            const ext = path.extname(fullPath).toLowerCase();
            let contentType = 'application/octet-stream';
            
            // Set appropriate content type
            const contentTypes = {
                '.txt': 'text/plain',
                '.json': 'application/json',
                '.js': 'application/javascript',
                '.html': 'text/html',
                '.css': 'text/css',
                '.xml': 'application/xml',
                '.md': 'text/markdown',
                '.csv': 'text/csv',
                '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg'
            };
            
            contentType = contentTypes[ext] || 'application/octet-stream';
            
            // For text-based files, read and return content as JSON
            const textTypes = ['.txt', '.json', '.js', '.html', '.css', '.xml', '.md', '.csv'];
            
            if (textTypes.includes(ext)) {
                const content = await fs.readFile(fullPath, 'utf8');
                res.json({
                    path: filePath,
                    contentType,
                    size: stats.size,
                    content,
                    encoding: 'utf8'
                });
            } else {
                // For binary files, stream the content directly
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
                
                const stream = require('fs').createReadStream(fullPath);
                stream.pipe(res);
            }
            
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ message: 'File not found' });
            }
            throw err;
        }
        
    } catch (err) {
        console.error('Error serving raw file:', err);
        res.status(500).json({ message: 'Failed to serve file' });
    }
});

app.get("/archive", authenticateUser, async (req, res) => {
    try {
        const { id: userId } = req.userAuth;
        const capturedPath = req.params[0] || '';
        const decodedPath = decodeURIComponent(capturedPath);
        const filePath = '/' + decodedPath;
        
        console.log('Archive request - Original captured path:', capturedPath);
        console.log('Archive request - Decoded path:', decodedPath);
        console.log('Archive request - Final file path:', filePath);
        
        const userDir = getUserDirectory(userId);
        const fullPath = path.join(userDir, filePath.replace(/^\/+/, ''));
        
        console.log('Full path:', fullPath);
        console.log('User dir:', userDir);
        
        if (!fullPath.startsWith(userDir)) {
            console.log('Security check failed - path outside user directory');
            return res.status(403).json({ message: 'Access denied' });
        }
        
        try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
                console.log('File found, serving:', fullPath);
                const fileName = path.basename(fullPath);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.sendFile(path.resolve(fullPath));
            } else {
                console.log('Path is not a file:', fullPath);
                res.status(400).json({ message: 'Path is not a file' });
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log('File not found:', fullPath);
                res.status(404).json({ message: 'File not found' });
            } else {
                console.error('Error serving file:', err);
                res.status(500).json({ message: 'Failed to serve file' });
            }
        }
    } catch (err) {
        console.error('Error serving file:', err);
        res.status(500).json({ message: 'Failed to serve file' });
    }
});

app.get('/health', (req, res) => {
    res.sendStatus(200);
});

// 404 handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

// Arranque del servidor
const PORT = process.env.PORT || 9876;
app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Clean up temp directory on server start
    console.log('Performing initial temp directory cleanup...');
    await cleanupTempDirectory();
    console.log('Server ready!');
});