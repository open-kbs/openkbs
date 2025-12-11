// SDK Demo Agent - Comprehensive Frontend SDK Examples
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, IconButton, Typography, Paper, TextField,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Tooltip, Chip, Tab, Tabs, Alert
} from '@mui/material';
import {
    Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon,
    Cancel as CancelIcon, Add as AddIcon, Refresh as RefreshIcon,
    Upload as UploadIcon, Share as ShareIcon, PersonAdd as PersonAddIcon,
    Memory as MemoryIcon, Folder as FolderIcon, Settings as SettingsIcon
} from '@mui/icons-material';

// ============================================================================
// MANAGE PANEL - Files, Memory, Sharing
// ============================================================================

const ManagePanel = ({ openkbs, setSystemAlert }) => {
    const [tab, setTab] = useState(0);

    return (
        <Paper sx={{ p: 2, mt: 2 }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab icon={<MemoryIcon />} label="Memory" />
                <Tab icon={<FolderIcon />} label="Files" />
                <Tab icon={<ShareIcon />} label="Sharing" />
            </Tabs>

            {tab === 0 && <MemoryTab openkbs={openkbs} setSystemAlert={setSystemAlert} />}
            {tab === 1 && <FilesTab openkbs={openkbs} setSystemAlert={setSystemAlert} />}
            {tab === 2 && <SharingTab openkbs={openkbs} setSystemAlert={setSystemAlert} />}
        </Paper>
    );
};

// ============================================================================
// MEMORY TAB - CRUD operations on items
// ============================================================================

const MemoryTab = ({ openkbs, setSystemAlert }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [newDialog, setNewDialog] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const result = await openkbs.fetchItems({
                beginsWith: 'memory_',
                limit: 100
            });
            setItems(result?.items || []);
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
        setLoading(false);
    }, [openkbs, setSystemAlert]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const saveItem = async (itemId) => {
        try {
            let value;
            try { value = JSON.parse(editValue); } catch { value = editValue; }

            await openkbs.updateItem({
                itemType: 'memory',
                itemId,
                body: { value, updatedAt: new Date().toISOString() }
            });
            setSystemAlert({ severity: 'success', message: 'Item saved' });
            setEditingItem(null);
            loadItems();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    const deleteItem = async (itemId) => {
        try {
            await openkbs.deleteItem(itemId);
            setSystemAlert({ severity: 'success', message: 'Item deleted' });
            loadItems();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    const createItem = async () => {
        const itemId = newKey.startsWith('memory_') ? newKey : `memory_${newKey}`;
        try {
            let value;
            try { value = JSON.parse(newValue); } catch { value = newValue; }

            await openkbs.createItem({
                itemType: 'memory',
                itemId,
                body: { value, updatedAt: new Date().toISOString() }
            });
            setSystemAlert({ severity: 'success', message: 'Item created' });
            setNewDialog(false);
            setNewKey('');
            setNewValue('');
            loadItems();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    const formatValue = (val) => {
        if (typeof val === 'object') return JSON.stringify(val, null, 2);
        return String(val);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Memory Items ({items.length})</Typography>
                <Box>
                    <IconButton onClick={loadItems} disabled={loading}>
                        <RefreshIcon />
                    </IconButton>
                    <Button startIcon={<AddIcon />} variant="contained" onClick={() => setNewDialog(true)}>
                        Add
                    </Button>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <List>
                    {items.map(({ meta, item }) => {
                        const isEditing = editingItem === meta.itemId;
                        const value = item?.body?.value;

                        return (
                            <ListItem key={meta.itemId} sx={{ flexDirection: 'column', alignItems: 'stretch', borderBottom: '1px solid #e0e0e0' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 'bold' }}>
                                        {meta.itemId}
                                    </Typography>
                                    <Box>
                                        {isEditing ? (
                                            <>
                                                <IconButton onClick={() => saveItem(meta.itemId)} color="primary">
                                                    <SaveIcon />
                                                </IconButton>
                                                <IconButton onClick={() => setEditingItem(null)}>
                                                    <CancelIcon />
                                                </IconButton>
                                            </>
                                        ) : (
                                            <>
                                                <IconButton onClick={() => { setEditingItem(meta.itemId); setEditValue(formatValue(value)); }}>
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton onClick={() => deleteItem(meta.itemId)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </>
                                        )}
                                    </Box>
                                </Box>
                                <Box sx={{ mt: 1 }}>
                                    {isEditing ? (
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={3}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            size="small"
                                        />
                                    ) : (
                                        <Typography
                                            variant="body2"
                                            sx={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5', p: 1, borderRadius: 1, fontSize: '12px', maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap' }}
                                        >
                                            {formatValue(value)}
                                        </Typography>
                                    )}
                                </Box>
                            </ListItem>
                        );
                    })}
                </List>
            )}

            <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Memory Item</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Key (without memory_ prefix)"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="Value (JSON or text)"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        multiline
                        rows={3}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewDialog(false)}>Cancel</Button>
                    <Button onClick={createItem} variant="contained" disabled={!newKey}>Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ============================================================================
// FILES TAB - List, upload, delete files
// ============================================================================

const FilesTab = ({ openkbs, setSystemAlert }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const result = await openkbs.Files.listFiles('files');
            setFiles(result || []);
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
        setLoading(false);
    }, [openkbs, setSystemAlert]);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            await openkbs.Files.uploadFileAPI(file, 'files', (percent) => {
                console.log(`Upload progress: ${percent}%`);
            });
            setSystemAlert({ severity: 'success', message: 'File uploaded' });
            loadFiles();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
        setUploading(false);
    };

    const deleteFile = async (filename) => {
        try {
            await openkbs.Files.deleteRawKBFile(filename, 'files');
            setSystemAlert({ severity: 'success', message: 'File deleted' });
            loadFiles();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFilename = (key) => key.split('/').pop();

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Files ({files.length})</Typography>
                <Box>
                    <IconButton onClick={loadFiles} disabled={loading}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        component="label"
                        variant="contained"
                        startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                        disabled={uploading}
                    >
                        Upload
                        <input type="file" hidden onChange={handleUpload} />
                    </Button>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <List>
                    {files.map((file) => (
                        <ListItem key={file.Key} sx={{ borderBottom: '1px solid #e0e0e0' }}>
                            <ListItemText
                                primary={getFilename(file.Key)}
                                secondary={`${formatSize(file.Size)} - ${new Date(file.LastModified).toLocaleString()}`}
                            />
                            <ListItemSecondaryAction>
                                <IconButton onClick={() => deleteFile(getFilename(file.Key))} color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                    {files.length === 0 && (
                        <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            No files uploaded yet
                        </Typography>
                    )}
                </List>
            )}
        </Box>
    );
};

// ============================================================================
// SHARING TAB - Share KB with users
// ============================================================================

const SharingTab = ({ openkbs, setSystemAlert }) => {
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');

    const loadShares = useCallback(async () => {
        setLoading(true);
        try {
            const result = await openkbs.KBAPI.getKBShares();
            setShares(result?.sharedWith || []);
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
        setLoading(false);
    }, [openkbs, setSystemAlert]);

    useEffect(() => { loadShares(); }, [loadShares]);

    const addShare = async () => {
        if (!email) return;
        try {
            await openkbs.KBAPI.shareKBWith(email);
            setSystemAlert({ severity: 'success', message: `Shared with ${email}` });
            setEmail('');
            loadShares();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    const removeShare = async (emailToRemove) => {
        try {
            await openkbs.KBAPI.unshareKBWith(emailToRemove);
            setSystemAlert({ severity: 'success', message: `Removed ${emailToRemove}` });
            loadShares();
        } catch (e) {
            setSystemAlert({ severity: 'error', message: e.message });
        }
    };

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Shared With ({shares.length})</Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    label="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addShare()}
                />
                <Button variant="contained" startIcon={<PersonAddIcon />} onClick={addShare} disabled={!email}>
                    Share
                </Button>
            </Box>

            {loading ? (
                <CircularProgress />
            ) : (
                <List>
                    {shares.map((sharedEmail) => (
                        <ListItem key={sharedEmail} sx={{ borderBottom: '1px solid #e0e0e0' }}>
                            <ListItemText primary={sharedEmail} />
                            <ListItemSecondaryAction>
                                <IconButton onClick={() => removeShare(sharedEmail)} color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                    {shares.length === 0 && (
                        <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            Not shared with anyone yet
                        </Typography>
                    )}
                </List>
            )}
        </Box>
    );
};

// ============================================================================
// HEADER COMPONENT
// ============================================================================

const Header = ({ setRenderSettings, openkbs, setSystemAlert, setBlockingLoading }) => {
    const [showPanel, setShowPanel] = useState(false);

    useEffect(() => {
        setRenderSettings({
            inputLabelsQuickSend: true,
            disableBalanceView: false,
            disableEmojiButton: true,
            disableChatModelsSelect: false,
            backgroundOpacity: 0.02
        });
    }, [setRenderSettings]);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                <Tooltip title="Manage Files, Memory & Sharing">
                    <IconButton onClick={() => setShowPanel(!showPanel)}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {showPanel && (
                <ManagePanel openkbs={openkbs} setSystemAlert={setSystemAlert} />
            )}
        </Box>
    );
};

// ============================================================================
// MESSAGE RENDERING
// ============================================================================

const COMMAND_PATTERNS = [
    /<setMemory>[\s\S]*?<\/setMemory>/,
    /<deleteItem>[\s\S]*?<\/deleteItem>/,
    /<createAIImage>[\s\S]*?<\/createAIImage>/,
    /<uploadFile>[\s\S]*?<\/uploadFile>/,
    /<viewImage>[\s\S]*?<\/viewImage>/,
    /<scheduleTask>[\s\S]*?<\/scheduleTask>/,
    /<getScheduledTasks\s*\/>/,
    /<sendMail>[\s\S]*?<\/sendMail>/,
    /<sendToTelegram>[\s\S]*?<\/sendToTelegram>/,
    /<googleSearch>[\s\S]*?<\/googleSearch>/,
    /<webpageToText>[\s\S]*?<\/webpageToText>/,
    /<cleanupMemory\s*\/>/
];

const commandIcons = {
    setMemory: MemoryIcon,
    deleteItem: DeleteIcon,
    cleanupMemory: RefreshIcon,
    createAIImage: () => '🖼️',
    uploadFile: UploadIcon,
    viewImage: () => '👁️',
    scheduleTask: () => '⏰',
    getScheduledTasks: () => '📋',
    sendMail: () => '📧',
    sendToTelegram: () => '📱',
    googleSearch: () => '🔍',
    webpageToText: () => '🌐'
};

const parseCommands = (content) => {
    const commands = [];
    const regex = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\s*\/>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1] || match[3];
        let data = match[2] || '';
        try { data = data.trim() ? JSON.parse(data.trim()) : {}; } catch { data = data.trim(); }
        commands.push({ name, data });
    }
    return commands;
};

const CommandChip = ({ command }) => {
    const Icon = commandIcons[command.name];
    return (
        <Tooltip title={<pre style={{ margin: 0, fontSize: 10 }}>{typeof command.data === 'object' ? JSON.stringify(command.data, null, 2) : command.data}</pre>}>
            <Chip
                icon={typeof Icon === 'function' && Icon.$$typeof ? <Icon /> : undefined}
                label={typeof Icon === 'function' && !Icon.$$typeof ? Icon() + ' ' + command.name : command.name}
                size="small"
                sx={{ m: 0.5 }}
            />
        </Tooltip>
    );
};

// onRenderChatMessage - do NOT use useState directly
const onRenderChatMessage = async (params) => {
    let { content, role } = params.messages[params.msgIndex];
    const { msgIndex, messages } = params;

    let JSONData;
    try { JSONData = JSON.parse(content); } catch {}

    // Hide CONTINUE type messages
    if (JSONData?.type === 'CONTINUE') {
        return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
    }

    // Render generated images
    if (JSONData?.type === 'CHAT_IMAGE' && JSONData?.data?.imageUrl) {
        return (
            <Box sx={{ maxWidth: '100%' }}>
                <img src={JSONData.data.imageUrl} alt="Generated" style={{ maxWidth: '100%', borderRadius: 8 }} />
            </Box>
        );
    }

    // Hide system responses to commands
    if (role === 'system' && JSONData && (JSONData._meta_type === 'EVENT_STARTED' || JSONData._meta_type === 'EVENT_FINISHED')) {
        if (msgIndex > 0) {
            const prevMessage = messages[msgIndex - 1];
            const prevHasCommand = COMMAND_PATTERNS.some(p => p.test(prevMessage.content));
            if (prevHasCommand && JSONData.type !== 'CHAT_IMAGE') {
                return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
            }
        }
    }

    // Render commands as chips
    const hasCommand = COMMAND_PATTERNS.some(p => p.test(content));
    if (hasCommand) {
        const commands = parseCommands(content);
        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {commands.map((cmd, i) => <CommandChip key={i} command={cmd} />)}
            </Box>
        );
    }

    return null; // Use default rendering
};

// ============================================================================
// EXPORTS
// ============================================================================

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
