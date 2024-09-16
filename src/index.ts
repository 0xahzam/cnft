import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createTree,
  mintV1,
  mplBubblegum,
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  signerIdentity,
  createGenericFile,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { wallet } from "./keypair";
import fs from "fs";
import path from "path";

const RPC_ENDPOINT = "https://api.devnet.solana.com";

const umi = createUmi(RPC_ENDPOINT)
  .use(mplBubblegum())
  .use(mplTokenMetadata())
  .use(
    irysUploader({
      address: "https://devnet.irys.xyz",
    })
  );

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
const merkleTree = generateSigner(umi);

async function main() {
  try {
    // Create merkle tree
    const createTreeTx = await createTree(umi, {
      merkleTree,
      maxDepth: 7,
      maxBufferSize: 16,
      canopyDepth: 4,
    });
    await createTreeTx.sendAndConfirm(umi);
    console.log("Merkle tree created successfully");

    // Read and upload the image file
    const imageFilePath = path.join(__dirname, "pfp.jpg");
    const imageFileContent = fs.readFileSync(imageFilePath);
    const genericImageFile = createGenericFile(imageFileContent, "pfp.jpg");
    const [imageUri] = await umi.uploader.upload([genericImageFile]);
    console.log("Image uploaded:", imageUri);

    // Create and upload metadata
    const nftMetadata = {
      name: "howdy",
      image: imageUri,
      externalUrl: "https://twitter.com/arjanjohan",
      attributes: [
        { trait_type: "twitter", value: "https://twitter.com/0xahzam" },
        { trait_type: "github", value: "https://github.com/0xahzam/" },
      ],
      properties: {
        files: [{ uri: imageUri, type: "image/jpeg" }],
      },
    };
    const nftMetadataUri = await umi.uploader.uploadJson(nftMetadata);
    console.log("Metadata uploaded:", nftMetadataUri);

    // Define the new owner
    const newOwner = publicKey("GdZMkNLe1R1Uzcna8U4QYVxtVVWvE3QZqkMYdtbVsohY");

    // Mint the cNFT
    const { signature } = await mintV1(umi, {
      leafOwner: newOwner,
      merkleTree: merkleTree.publicKey,
      metadata: {
        name: "ahzam's cNFT",
        uri: nftMetadataUri,
        sellerFeeBasisPoints: 500,
        collection: { key: merkleTree.publicKey, verified: false },
        creators: [
          { address: umi.identity.publicKey, verified: true, share: 100 },
        ],
      },
    }).sendAndConfirm(umi);

    console.log("NFT minted successfully. Signature:", signature);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

main();
