import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const AutoUpdater = () => {
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  useEffect(() => {
    // Check for updates on component mount
    window.electronAPI.checkForUpdates();

    // Set up listeners for update events
    window.electronAPI.onUpdateAvailable(() => {
      setUpdateAvailable(true);
      setUpdateStatus('Update available');
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateStatus('No updates available');
    });

    window.electronAPI.onUpdateError((error) => {
      setUpdateStatus(`Error: ${error}`);
    });

    window.electronAPI.onDownloadProgress((progressObj) => {
      setDownloadProgress(progressObj.percent);
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
      setUpdateStatus('Update downloaded');
    });

    window.electronAPI.onUpdateMessage((message) => {
      setUpdateStatus(message);
    });
  }, []);

  const checkForUpdates = () => {
    window.electronAPI.checkForUpdates();
  };

  const downloadUpdate = () => {
    window.electronAPI.downloadUpdate();
  };

  const installUpdate = () => {
    window.electronAPI.installUpdate();
  };

  return (
    <div className="p-4 space-y-4">
      <Alert>
        <AlertTitle>Auto-Update Status</AlertTitle>
        <AlertDescription>{updateStatus}</AlertDescription>
      </Alert>

      {downloadProgress > 0 && (
        <Progress value={downloadProgress} className="w-full" />
      )}

      <div className="space-x-2">
        <Button onClick={checkForUpdates}>Check for Updates</Button>
        {updateAvailable && !updateDownloaded && (
          <Button onClick={downloadUpdate}>Download Update</Button>
        )}
        {updateDownloaded && (
          <Button onClick={installUpdate}>Install Update</Button>
        )}
      </div>
    </div>
  );
};

export default AutoUpdater;
