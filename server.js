const express = require('express');
const path = require('path');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const port = process.env.PORT || 8080;
const accountName = process.env.AZURE_STORAGE_ACCOUNT || 'storiskcontrolcenter';
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'dashboard-data';

const credential = new DefaultAzureCredential();
const blobService = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential
);
const container = blobService.getContainerClient(containerName);

async function streamJsonBlob(blobName, req, res) {
  try {
    const blob = container.getBlobClient(blobName);
    const download = await blob.download();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    if (download.contentLength) res.setHeader('Content-Length', download.contentLength);
    download.readableStreamBody.on('error', (err) => {
      console.error(`Stream error for ${blobName}:`, err);
      if (!res.headersSent) res.status(500).json({ error: 'Error al leer el archivo' });
      else res.destroy(err);
    });
    download.readableStreamBody.pipe(res);
  } catch (err) {
    console.error(`Blob error for ${blobName}:`, err.message);
    res.status(err.statusCode || 500).json({ error: 'No se pudo obtener el archivo solicitado' });
  }
}

app.get('/api/data', (req, res) => streamJsonBlob('data.json', req, res));
app.get('/api/base-registros', (req, res) => streamJsonBlob('base_registros.json', req, res));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(express.static(__dirname, { index: 'index.html' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(port, () => console.log(`Operational Risk Control Center listening on ${port}`));
