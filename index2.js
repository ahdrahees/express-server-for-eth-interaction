const axios = require("axios");
const express = require("express");
const mongoose = require("mongoose");
const { Web3 } = require("web3");
const dotenv = require("dotenv").config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONG_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define NFT Metadata Schema
const NFTMetadataSchema = new mongoose.Schema({
  contractAddress: { type: String, required: true },
  tokenId: { type: Number, min: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, required: true },
});

// Create NFTMetadata model
const NFTMetadata = mongoose.model("NFTMetadata", NFTMetadataSchema);

const web3 = new Web3(process.env.ETH_MAINNET_RPC_URL);

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

const ERC721_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

function convertTokenUriToURL(tokenUri) {
  if (tokenUri.startsWith("ipfs://")) {
    const ipfsHash = tokenUri.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${ipfsHash}`;
  } else if (tokenUri.startsWith("https://")) {
    return tokenUri;
  } else {
    throw new Error("Invalid IPFS URI");
  }
}

app.get("/token-balance/:contractAddress/:walletAddress", async (req, res) => {
  const { contractAddress, walletAddress } = req.params;

  try {
    const tokenContract = new web3.eth.Contract(ERC20_ABI, contractAddress);

    // BigInt
    const balanceToken = await tokenContract.methods
      .balanceOf(walletAddress)
      .call();
    // BigInt
    const decimals = await tokenContract.methods.decimals().call();

    const balance = Number(balanceToken) / 10 ** Number(decimals);

    res.status(200).json({ balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching token balance" + error,
    });
  }
});

app.get("/nft-metadata/:contractAddress/:tokenId", async (req, res) => {
  const { contractAddress, tokenId } = req.params;

  try {
    let nftMetadata = await NFTMetadata.findOne({
      contractAddress,
      tokenId: Number(tokenId),
    });

    if (!nftMetadata) {
      const nftContracct = new web3.eth.Contract(ERC721_ABI, contractAddress);
      const tokenURI = await nftContracct.methods.tokenURI(tokenId).call();

      const url = convertTokenUriToURL(tokenURI);

      const response = await axios.get(url);

      nftMetadata = new NFTMetadata({
        contractAddress,
        tokenId: Number(tokenId),
        // metadata: JSON.stringify(response.data),
        metadata: response.data,
      });
      await nftMetadata.save();

      res.status(200).json(response.data);
    } else {
      res.status(200).json(nftMetadata.metadata);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching NFT metadata" + error,
    });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
