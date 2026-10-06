# ECS M3 verified dispatch

- Base commit: `5890d2dcd4f9943395e5d5c73a58efc0cbb8ee18`
- Payload SHA-256: `938e3ddd5eb01158c436f40955fde59a4f20b1a30e6ec12e96f807f5a0be4d9e`
- Target milestone commit: `refactor(littlewild): complete ECS M3 world logistics`

This checkpoint dispatches the checksum-pinned M3 patch to the branch verification workflow. The workflow must apply the patch to the exact branch head, run the complete v15 verification gate, rebuild `littlewild.html`, commit the source and generated evidence, and push the resulting milestone commit to PR25.
