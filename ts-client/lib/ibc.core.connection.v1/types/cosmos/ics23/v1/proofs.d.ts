import _m0 from "protobufjs/minimal";
export declare const protobufPackage = "cosmos.ics23.v1";
export declare enum HashOp {
    /** NO_HASH - NO_HASH is the default if no data passed. Note this is an illegal argument some places. */
    NO_HASH = 0,
    SHA256 = 1,
    SHA512 = 2,
    KECCAK = 3,
    RIPEMD160 = 4,
    /** BITCOIN - ripemd160(sha256(x)) */
    BITCOIN = 5,
    SHA512_256 = 6,
    UNRECOGNIZED = -1
}
export declare function hashOpFromJSON(object: any): HashOp;
export declare function hashOpToJSON(object: HashOp): string;
/**
 * LengthOp defines how to process the key and value of the LeafOp
 * to include length information. After encoding the length with the given
 * algorithm, the length will be prepended to the key and value bytes.
 * (Each one with it's own encoded length)
 */
export declare enum LengthOp {
    /** NO_PREFIX - NO_PREFIX don't include any length info */
    NO_PREFIX = 0,
    /** VAR_PROTO - VAR_PROTO uses protobuf (and go-amino) varint encoding of the length */
    VAR_PROTO = 1,
    /** VAR_RLP - VAR_RLP uses rlp int encoding of the length */
    VAR_RLP = 2,
    /** FIXED32_BIG - FIXED32_BIG uses big-endian encoding of the length as a 32 bit integer */
    FIXED32_BIG = 3,
    /** FIXED32_LITTLE - FIXED32_LITTLE uses little-endian encoding of the length as a 32 bit integer */
    FIXED32_LITTLE = 4,
    /** FIXED64_BIG - FIXED64_BIG uses big-endian encoding of the length as a 64 bit integer */
    FIXED64_BIG = 5,
    /** FIXED64_LITTLE - FIXED64_LITTLE uses little-endian encoding of the length as a 64 bit integer */
    FIXED64_LITTLE = 6,
    /** REQUIRE_32_BYTES - REQUIRE_32_BYTES is like NONE, but will fail if the input is not exactly 32 bytes (sha256 output) */
    REQUIRE_32_BYTES = 7,
    /** REQUIRE_64_BYTES - REQUIRE_64_BYTES is like NONE, but will fail if the input is not exactly 64 bytes (sha512 output) */
    REQUIRE_64_BYTES = 8,
    UNRECOGNIZED = -1
}
export declare function lengthOpFromJSON(object: any): LengthOp;
export declare function lengthOpToJSON(object: LengthOp): string;
/**
 * ExistenceProof takes a key and a value and a set of steps to perform on it.
 * The result of peforming all these steps will provide a "root hash", which can
 * be compared to the value in a header.
 *
 * Since it is computationally infeasible to produce a hash collission for any of the used
 * cryptographic hash functions, if someone can provide a series of operations to transform
 * a given key and value into a root hash that matches some trusted root, these key and values
 * must be in the referenced merkle tree.
 *
 * The only possible issue is maliablity in LeafOp, such as providing extra prefix data,
 * which should be controlled by a spec. Eg. with lengthOp as NONE,
 * prefix = FOO, key = BAR, value = CHOICE
 * and
 * prefix = F, key = OOBAR, value = CHOICE
 * would produce the same value.
 *
 * With LengthOp this is tricker but not impossible. Which is why the "leafPrefixEqual" field
 * in the ProofSpec is valuable to prevent this mutability. And why all trees should
 * length-prefix the data before hashing it.
 */
export interface ExistenceProof {
    key: Uint8Array;
    value: Uint8Array;
    leaf: LeafOp | undefined;
    path: InnerOp[];
}
/**
 * NonExistenceProof takes a proof of two neighbors, one left of the desired key,
 * one right of the desired key. If both proofs are valid AND they are neighbors,
 * then there is no valid proof for the given key.
 */
export interface NonExistenceProof {
    /** TODO: remove this as unnecessary??? we prove a range */
    key: Uint8Array;
    left: ExistenceProof | undefined;
    right: ExistenceProof | undefined;
}
/** CommitmentProof is either an ExistenceProof or a NonExistenceProof, or a Batch of such messages */
export interface CommitmentProof {
    exist?: ExistenceProof | undefined;
    nonexist?: NonExistenceProof | undefined;
    batch?: BatchProof | undefined;
    compressed?: CompressedBatchProof | undefined;
}
/**
 * LeafOp represents the raw key-value data we wish to prove, and
 * must be flexible to represent the internal transformation from
 * the original key-value pairs into the basis hash, for many existing
 * merkle trees.
 *
 * key and value are passed in. So that the signature of this operation is:
 * leafOp(key, value) -> output
 *
 * To process this, first prehash the keys and values if needed (ANY means no hash in this case):
 * hkey = prehashKey(key)
 * hvalue = prehashValue(value)
 *
 * Then combine the bytes, and hash it
 * output = hash(prefix || length(hkey) || hkey || length(hvalue) || hvalue)
 */
export interface LeafOp {
    hash: HashOp;
    prehashKey: HashOp;
    prehashValue: HashOp;
    length: LengthOp;
    /**
     * prefix is a fixed bytes that may optionally be included at the beginning to differentiate
     * a leaf node from an inner node.
     */
    prefix: Uint8Array;
}
/**
 * InnerOp represents a merkle-proof step that is not a leaf.
 * It represents concatenating two children and hashing them to provide the next result.
 *
 * The result of the previous step is passed in, so the signature of this op is:
 * innerOp(child) -> output
 *
 * The result of applying InnerOp should be:
 * output = op.hash(op.prefix || child || op.suffix)
 *
 * where the || operator is concatenation of binary data,
 * and child is the result of hashing all the tree below this step.
 *
 * Any special data, like prepending child with the length, or prepending the entire operation with
 * some value to differentiate from leaf nodes, should be included in prefix and suffix.
 * If either of prefix or suffix is empty, we just treat it as an empty string
 */
export interface InnerOp {
    hash: HashOp;
    prefix: Uint8Array;
    suffix: Uint8Array;
}
/**
 * ProofSpec defines what the expected parameters are for a given proof type.
 * This can be stored in the client and used to validate any incoming proofs.
 *
 * verify(ProofSpec, Proof) -> Proof | Error
 *
 * As demonstrated in tests, if we don't fix the algorithm used to calculate the
 * LeafHash for a given tree, there are many possible key-value pairs that can
 * generate a given hash (by interpretting the preimage differently).
 * We need this for proper security, requires client knows a priori what
 * tree format server uses. But not in code, rather a configuration object.
 */
export interface ProofSpec {
    /**
     * any field in the ExistenceProof must be the same as in this spec.
     * except Prefix, which is just the first bytes of prefix (spec can be longer)
     */
    leafSpec: LeafOp | undefined;
    innerSpec: InnerSpec | undefined;
    /** max_depth (if > 0) is the maximum number of InnerOps allowed (mainly for fixed-depth tries) */
    maxDepth: number;
    /** min_depth (if > 0) is the minimum number of InnerOps allowed (mainly for fixed-depth tries) */
    minDepth: number;
}
/**
 * InnerSpec contains all store-specific structure info to determine if two proofs from a
 * given store are neighbors.
 *
 * This enables:
 *
 * isLeftMost(spec: InnerSpec, op: InnerOp)
 * isRightMost(spec: InnerSpec, op: InnerOp)
 * isLeftNeighbor(spec: InnerSpec, left: InnerOp, right: InnerOp)
 */
export interface InnerSpec {
    /**
     * Child order is the ordering of the children node, must count from 0
     * iavl tree is [0, 1] (left then right)
     * merk is [0, 2, 1] (left, right, here)
     */
    childOrder: number[];
    childSize: number;
    minPrefixLength: number;
    maxPrefixLength: number;
    /** empty child is the prehash image that is used when one child is nil (eg. 20 bytes of 0) */
    emptyChild: Uint8Array;
    /** hash is the algorithm that must be used for each InnerOp */
    hash: HashOp;
}
/** BatchProof is a group of multiple proof types than can be compressed */
export interface BatchProof {
    entries: BatchEntry[];
}
/** Use BatchEntry not CommitmentProof, to avoid recursion */
export interface BatchEntry {
    exist?: ExistenceProof | undefined;
    nonexist?: NonExistenceProof | undefined;
}
export interface CompressedBatchProof {
    entries: CompressedBatchEntry[];
    lookupInners: InnerOp[];
}
/** Use BatchEntry not CommitmentProof, to avoid recursion */
export interface CompressedBatchEntry {
    exist?: CompressedExistenceProof | undefined;
    nonexist?: CompressedNonExistenceProof | undefined;
}
export interface CompressedExistenceProof {
    key: Uint8Array;
    value: Uint8Array;
    leaf: LeafOp | undefined;
    /** these are indexes into the lookup_inners table in CompressedBatchProof */
    path: number[];
}
export interface CompressedNonExistenceProof {
    /** TODO: remove this as unnecessary??? we prove a range */
    key: Uint8Array;
    left: CompressedExistenceProof | undefined;
    right: CompressedExistenceProof | undefined;
}
export declare const ExistenceProof: {
    encode(message: ExistenceProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): ExistenceProof;
    fromJSON(object: any): ExistenceProof;
    toJSON(message: ExistenceProof): unknown;
    create<I extends {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        path?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[];
    } & {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K in Exclude<keyof I["leaf"], keyof LeafOp>]: never; };
        path?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[] & ({
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & { [K_1 in Exclude<keyof I["path"][number], keyof InnerOp>]: never; })[] & { [K_2 in Exclude<keyof I["path"], keyof {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[]>]: never; };
    } & { [K_3 in Exclude<keyof I, keyof ExistenceProof>]: never; }>(base?: I): ExistenceProof;
    fromPartial<I_1 extends {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        path?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[];
    } & {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K_4 in Exclude<keyof I_1["leaf"], keyof LeafOp>]: never; };
        path?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[] & ({
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & { [K_5 in Exclude<keyof I_1["path"][number], keyof InnerOp>]: never; })[] & { [K_6 in Exclude<keyof I_1["path"], keyof {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[]>]: never; };
    } & { [K_7 in Exclude<keyof I_1, keyof ExistenceProof>]: never; }>(object: I_1): ExistenceProof;
};
export declare const NonExistenceProof: {
    encode(message: NonExistenceProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): NonExistenceProof;
    fromJSON(object: any): NonExistenceProof;
    toJSON(message: NonExistenceProof): unknown;
    create<I extends {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
    } & {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K in Exclude<keyof I["left"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_1 in Exclude<keyof I["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_2 in Exclude<keyof I["left"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_3 in Exclude<keyof I["left"], keyof ExistenceProof>]: never; };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_4 in Exclude<keyof I["right"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_5 in Exclude<keyof I["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_6 in Exclude<keyof I["right"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_7 in Exclude<keyof I["right"], keyof ExistenceProof>]: never; };
    } & { [K_8 in Exclude<keyof I, keyof NonExistenceProof>]: never; }>(base?: I): NonExistenceProof;
    fromPartial<I_1 extends {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
    } & {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_9 in Exclude<keyof I_1["left"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_10 in Exclude<keyof I_1["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_11 in Exclude<keyof I_1["left"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_12 in Exclude<keyof I_1["left"], keyof ExistenceProof>]: never; };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_13 in Exclude<keyof I_1["right"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_14 in Exclude<keyof I_1["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_15 in Exclude<keyof I_1["right"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_16 in Exclude<keyof I_1["right"], keyof ExistenceProof>]: never; };
    } & { [K_17 in Exclude<keyof I_1, keyof NonExistenceProof>]: never; }>(object: I_1): NonExistenceProof;
};
export declare const CommitmentProof: {
    encode(message: CommitmentProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): CommitmentProof;
    fromJSON(object: any): CommitmentProof;
    toJSON(message: CommitmentProof): unknown;
    create<I extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        };
        batch?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[];
        };
        compressed?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[];
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K in Exclude<keyof I["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_1 in Exclude<keyof I["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_2 in Exclude<keyof I["exist"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_3 in Exclude<keyof I["exist"], keyof ExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_4 in Exclude<keyof I["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_5 in Exclude<keyof I["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_6 in Exclude<keyof I["nonexist"]["left"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_7 in Exclude<keyof I["nonexist"]["left"], keyof ExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_8 in Exclude<keyof I["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_9 in Exclude<keyof I["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_10 in Exclude<keyof I["nonexist"]["right"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_11 in Exclude<keyof I["nonexist"]["right"], keyof ExistenceProof>]: never; };
        } & { [K_12 in Exclude<keyof I["nonexist"], keyof NonExistenceProof>]: never; };
        batch?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[];
        } & {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[] & ({
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            } & {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_13 in Exclude<keyof I["batch"]["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_14 in Exclude<keyof I["batch"]["entries"][number]["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_15 in Exclude<keyof I["batch"]["entries"][number]["exist"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_16 in Exclude<keyof I["batch"]["entries"][number]["exist"], keyof ExistenceProof>]: never; };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                } & {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_17 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[] & ({
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & { [K_18 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_19 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["left"]["path"], keyof {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[]>]: never; };
                    } & { [K_20 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["left"], keyof ExistenceProof>]: never; };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_21 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[] & ({
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & { [K_22 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_23 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["right"]["path"], keyof {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[]>]: never; };
                    } & { [K_24 in Exclude<keyof I["batch"]["entries"][number]["nonexist"]["right"], keyof ExistenceProof>]: never; };
                } & { [K_25 in Exclude<keyof I["batch"]["entries"][number]["nonexist"], keyof NonExistenceProof>]: never; };
            } & { [K_26 in Exclude<keyof I["batch"]["entries"][number], keyof BatchEntry>]: never; })[] & { [K_27 in Exclude<keyof I["batch"]["entries"], keyof {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[]>]: never; };
        } & { [K_28 in Exclude<keyof I["batch"], "entries">]: never; };
        compressed?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[];
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[] & ({
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            } & {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_29 in Exclude<keyof I["compressed"]["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_30 in Exclude<keyof I["compressed"]["entries"][number]["exist"]["path"], keyof number[]>]: never; };
                } & { [K_31 in Exclude<keyof I["compressed"]["entries"][number]["exist"], keyof CompressedExistenceProof>]: never; };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                } & {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_32 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                        path?: number[] & number[] & { [K_33 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["left"]["path"], keyof number[]>]: never; };
                    } & { [K_34 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_35 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                        path?: number[] & number[] & { [K_36 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["right"]["path"], keyof number[]>]: never; };
                    } & { [K_37 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
                } & { [K_38 in Exclude<keyof I["compressed"]["entries"][number]["nonexist"], keyof CompressedNonExistenceProof>]: never; };
            } & { [K_39 in Exclude<keyof I["compressed"]["entries"][number], keyof CompressedBatchEntry>]: never; })[] & { [K_40 in Exclude<keyof I["compressed"]["entries"], keyof {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[]>]: never; };
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_41 in Exclude<keyof I["compressed"]["lookupInners"][number], keyof InnerOp>]: never; })[] & { [K_42 in Exclude<keyof I["compressed"]["lookupInners"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_43 in Exclude<keyof I["compressed"], keyof CompressedBatchProof>]: never; };
    } & { [K_44 in Exclude<keyof I, keyof CommitmentProof>]: never; }>(base?: I): CommitmentProof;
    fromPartial<I_1 extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        };
        batch?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[];
        };
        compressed?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[];
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_45 in Exclude<keyof I_1["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_46 in Exclude<keyof I_1["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_47 in Exclude<keyof I_1["exist"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_48 in Exclude<keyof I_1["exist"], keyof ExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_49 in Exclude<keyof I_1["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_50 in Exclude<keyof I_1["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_51 in Exclude<keyof I_1["nonexist"]["left"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_52 in Exclude<keyof I_1["nonexist"]["left"], keyof ExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_53 in Exclude<keyof I_1["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_54 in Exclude<keyof I_1["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_55 in Exclude<keyof I_1["nonexist"]["right"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_56 in Exclude<keyof I_1["nonexist"]["right"], keyof ExistenceProof>]: never; };
        } & { [K_57 in Exclude<keyof I_1["nonexist"], keyof NonExistenceProof>]: never; };
        batch?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[];
        } & {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[] & ({
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            } & {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_58 in Exclude<keyof I_1["batch"]["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_59 in Exclude<keyof I_1["batch"]["entries"][number]["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_60 in Exclude<keyof I_1["batch"]["entries"][number]["exist"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_61 in Exclude<keyof I_1["batch"]["entries"][number]["exist"], keyof ExistenceProof>]: never; };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                } & {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_62 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[] & ({
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & { [K_63 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_64 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["left"]["path"], keyof {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[]>]: never; };
                    } & { [K_65 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["left"], keyof ExistenceProof>]: never; };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_66 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[] & ({
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        } & { [K_67 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_68 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["right"]["path"], keyof {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[]>]: never; };
                    } & { [K_69 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"]["right"], keyof ExistenceProof>]: never; };
                } & { [K_70 in Exclude<keyof I_1["batch"]["entries"][number]["nonexist"], keyof NonExistenceProof>]: never; };
            } & { [K_71 in Exclude<keyof I_1["batch"]["entries"][number], keyof BatchEntry>]: never; })[] & { [K_72 in Exclude<keyof I_1["batch"]["entries"], keyof {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: {
                            hash?: HashOp;
                            prefix?: Uint8Array;
                            suffix?: Uint8Array;
                        }[];
                    };
                };
            }[]>]: never; };
        } & { [K_73 in Exclude<keyof I_1["batch"], "entries">]: never; };
        compressed?: {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[];
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            entries?: {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[] & ({
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            } & {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_74 in Exclude<keyof I_1["compressed"]["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_75 in Exclude<keyof I_1["compressed"]["entries"][number]["exist"]["path"], keyof number[]>]: never; };
                } & { [K_76 in Exclude<keyof I_1["compressed"]["entries"][number]["exist"], keyof CompressedExistenceProof>]: never; };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                } & {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_77 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                        path?: number[] & number[] & { [K_78 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["left"]["path"], keyof number[]>]: never; };
                    } & { [K_79 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    } & {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        } & { [K_80 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                        path?: number[] & number[] & { [K_81 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["right"]["path"], keyof number[]>]: never; };
                    } & { [K_82 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
                } & { [K_83 in Exclude<keyof I_1["compressed"]["entries"][number]["nonexist"], keyof CompressedNonExistenceProof>]: never; };
            } & { [K_84 in Exclude<keyof I_1["compressed"]["entries"][number], keyof CompressedBatchEntry>]: never; })[] & { [K_85 in Exclude<keyof I_1["compressed"]["entries"], keyof {
                exist?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                nonexist?: {
                    key?: Uint8Array;
                    left?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                    right?: {
                        key?: Uint8Array;
                        value?: Uint8Array;
                        leaf?: {
                            hash?: HashOp;
                            prehashKey?: HashOp;
                            prehashValue?: HashOp;
                            length?: LengthOp;
                            prefix?: Uint8Array;
                        };
                        path?: number[];
                    };
                };
            }[]>]: never; };
            lookupInners?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_86 in Exclude<keyof I_1["compressed"]["lookupInners"][number], keyof InnerOp>]: never; })[] & { [K_87 in Exclude<keyof I_1["compressed"]["lookupInners"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_88 in Exclude<keyof I_1["compressed"], keyof CompressedBatchProof>]: never; };
    } & { [K_89 in Exclude<keyof I_1, keyof CommitmentProof>]: never; }>(object: I_1): CommitmentProof;
};
export declare const LeafOp: {
    encode(message: LeafOp, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): LeafOp;
    fromJSON(object: any): LeafOp;
    toJSON(message: LeafOp): unknown;
    create<I extends {
        hash?: HashOp;
        prehashKey?: HashOp;
        prehashValue?: HashOp;
        length?: LengthOp;
        prefix?: Uint8Array;
    } & {
        hash?: HashOp;
        prehashKey?: HashOp;
        prehashValue?: HashOp;
        length?: LengthOp;
        prefix?: Uint8Array;
    } & { [K in Exclude<keyof I, keyof LeafOp>]: never; }>(base?: I): LeafOp;
    fromPartial<I_1 extends {
        hash?: HashOp;
        prehashKey?: HashOp;
        prehashValue?: HashOp;
        length?: LengthOp;
        prefix?: Uint8Array;
    } & {
        hash?: HashOp;
        prehashKey?: HashOp;
        prehashValue?: HashOp;
        length?: LengthOp;
        prefix?: Uint8Array;
    } & { [K_1 in Exclude<keyof I_1, keyof LeafOp>]: never; }>(object: I_1): LeafOp;
};
export declare const InnerOp: {
    encode(message: InnerOp, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): InnerOp;
    fromJSON(object: any): InnerOp;
    toJSON(message: InnerOp): unknown;
    create<I extends {
        hash?: HashOp;
        prefix?: Uint8Array;
        suffix?: Uint8Array;
    } & {
        hash?: HashOp;
        prefix?: Uint8Array;
        suffix?: Uint8Array;
    } & { [K in Exclude<keyof I, keyof InnerOp>]: never; }>(base?: I): InnerOp;
    fromPartial<I_1 extends {
        hash?: HashOp;
        prefix?: Uint8Array;
        suffix?: Uint8Array;
    } & {
        hash?: HashOp;
        prefix?: Uint8Array;
        suffix?: Uint8Array;
    } & { [K_1 in Exclude<keyof I_1, keyof InnerOp>]: never; }>(object: I_1): InnerOp;
};
export declare const ProofSpec: {
    encode(message: ProofSpec, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): ProofSpec;
    fromJSON(object: any): ProofSpec;
    toJSON(message: ProofSpec): unknown;
    create<I extends {
        leafSpec?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        innerSpec?: {
            childOrder?: number[];
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        };
        maxDepth?: number;
        minDepth?: number;
    } & {
        leafSpec?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K in Exclude<keyof I["leafSpec"], keyof LeafOp>]: never; };
        innerSpec?: {
            childOrder?: number[];
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        } & {
            childOrder?: number[] & number[] & { [K_1 in Exclude<keyof I["innerSpec"]["childOrder"], keyof number[]>]: never; };
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        } & { [K_2 in Exclude<keyof I["innerSpec"], keyof InnerSpec>]: never; };
        maxDepth?: number;
        minDepth?: number;
    } & { [K_3 in Exclude<keyof I, keyof ProofSpec>]: never; }>(base?: I): ProofSpec;
    fromPartial<I_1 extends {
        leafSpec?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        innerSpec?: {
            childOrder?: number[];
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        };
        maxDepth?: number;
        minDepth?: number;
    } & {
        leafSpec?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K_4 in Exclude<keyof I_1["leafSpec"], keyof LeafOp>]: never; };
        innerSpec?: {
            childOrder?: number[];
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        } & {
            childOrder?: number[] & number[] & { [K_5 in Exclude<keyof I_1["innerSpec"]["childOrder"], keyof number[]>]: never; };
            childSize?: number;
            minPrefixLength?: number;
            maxPrefixLength?: number;
            emptyChild?: Uint8Array;
            hash?: HashOp;
        } & { [K_6 in Exclude<keyof I_1["innerSpec"], keyof InnerSpec>]: never; };
        maxDepth?: number;
        minDepth?: number;
    } & { [K_7 in Exclude<keyof I_1, keyof ProofSpec>]: never; }>(object: I_1): ProofSpec;
};
export declare const InnerSpec: {
    encode(message: InnerSpec, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): InnerSpec;
    fromJSON(object: any): InnerSpec;
    toJSON(message: InnerSpec): unknown;
    create<I extends {
        childOrder?: number[];
        childSize?: number;
        minPrefixLength?: number;
        maxPrefixLength?: number;
        emptyChild?: Uint8Array;
        hash?: HashOp;
    } & {
        childOrder?: number[] & number[] & { [K in Exclude<keyof I["childOrder"], keyof number[]>]: never; };
        childSize?: number;
        minPrefixLength?: number;
        maxPrefixLength?: number;
        emptyChild?: Uint8Array;
        hash?: HashOp;
    } & { [K_1 in Exclude<keyof I, keyof InnerSpec>]: never; }>(base?: I): InnerSpec;
    fromPartial<I_1 extends {
        childOrder?: number[];
        childSize?: number;
        minPrefixLength?: number;
        maxPrefixLength?: number;
        emptyChild?: Uint8Array;
        hash?: HashOp;
    } & {
        childOrder?: number[] & number[] & { [K_2 in Exclude<keyof I_1["childOrder"], keyof number[]>]: never; };
        childSize?: number;
        minPrefixLength?: number;
        maxPrefixLength?: number;
        emptyChild?: Uint8Array;
        hash?: HashOp;
    } & { [K_3 in Exclude<keyof I_1, keyof InnerSpec>]: never; }>(object: I_1): InnerSpec;
};
export declare const BatchProof: {
    encode(message: BatchProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): BatchProof;
    fromJSON(object: any): BatchProof;
    toJSON(message: BatchProof): unknown;
    create<I extends {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[];
    } & {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[] & ({
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        } & {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K in Exclude<keyof I["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_1 in Exclude<keyof I["entries"][number]["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_2 in Exclude<keyof I["entries"][number]["exist"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_3 in Exclude<keyof I["entries"][number]["exist"], keyof ExistenceProof>]: never; };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            } & {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_4 in Exclude<keyof I["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_5 in Exclude<keyof I["entries"][number]["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_6 in Exclude<keyof I["entries"][number]["nonexist"]["left"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_7 in Exclude<keyof I["entries"][number]["nonexist"]["left"], keyof ExistenceProof>]: never; };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_8 in Exclude<keyof I["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_9 in Exclude<keyof I["entries"][number]["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_10 in Exclude<keyof I["entries"][number]["nonexist"]["right"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_11 in Exclude<keyof I["entries"][number]["nonexist"]["right"], keyof ExistenceProof>]: never; };
            } & { [K_12 in Exclude<keyof I["entries"][number]["nonexist"], keyof NonExistenceProof>]: never; };
        } & { [K_13 in Exclude<keyof I["entries"][number], keyof BatchEntry>]: never; })[] & { [K_14 in Exclude<keyof I["entries"], keyof {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[]>]: never; };
    } & { [K_15 in Exclude<keyof I, "entries">]: never; }>(base?: I): BatchProof;
    fromPartial<I_1 extends {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[];
    } & {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[] & ({
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        } & {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_16 in Exclude<keyof I_1["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_17 in Exclude<keyof I_1["entries"][number]["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_18 in Exclude<keyof I_1["entries"][number]["exist"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_19 in Exclude<keyof I_1["entries"][number]["exist"], keyof ExistenceProof>]: never; };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            } & {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_20 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_21 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_22 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_23 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"], keyof ExistenceProof>]: never; };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_24 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[] & ({
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    } & { [K_25 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_26 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"]["path"], keyof {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[]>]: never; };
                } & { [K_27 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"], keyof ExistenceProof>]: never; };
            } & { [K_28 in Exclude<keyof I_1["entries"][number]["nonexist"], keyof NonExistenceProof>]: never; };
        } & { [K_29 in Exclude<keyof I_1["entries"][number], keyof BatchEntry>]: never; })[] & { [K_30 in Exclude<keyof I_1["entries"], keyof {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: {
                        hash?: HashOp;
                        prefix?: Uint8Array;
                        suffix?: Uint8Array;
                    }[];
                };
            };
        }[]>]: never; };
    } & { [K_31 in Exclude<keyof I_1, "entries">]: never; }>(object: I_1): BatchProof;
};
export declare const BatchEntry: {
    encode(message: BatchEntry, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): BatchEntry;
    fromJSON(object: any): BatchEntry;
    toJSON(message: BatchEntry): unknown;
    create<I extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K in Exclude<keyof I["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_1 in Exclude<keyof I["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_2 in Exclude<keyof I["exist"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_3 in Exclude<keyof I["exist"], keyof ExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_4 in Exclude<keyof I["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_5 in Exclude<keyof I["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_6 in Exclude<keyof I["nonexist"]["left"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_7 in Exclude<keyof I["nonexist"]["left"], keyof ExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_8 in Exclude<keyof I["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_9 in Exclude<keyof I["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_10 in Exclude<keyof I["nonexist"]["right"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_11 in Exclude<keyof I["nonexist"]["right"], keyof ExistenceProof>]: never; };
        } & { [K_12 in Exclude<keyof I["nonexist"], keyof NonExistenceProof>]: never; };
    } & { [K_13 in Exclude<keyof I, keyof BatchEntry>]: never; }>(base?: I): BatchEntry;
    fromPartial<I_1 extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_14 in Exclude<keyof I_1["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[] & ({
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            } & { [K_15 in Exclude<keyof I_1["exist"]["path"][number], keyof InnerOp>]: never; })[] & { [K_16 in Exclude<keyof I_1["exist"]["path"], keyof {
                hash?: HashOp;
                prefix?: Uint8Array;
                suffix?: Uint8Array;
            }[]>]: never; };
        } & { [K_17 in Exclude<keyof I_1["exist"], keyof ExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_18 in Exclude<keyof I_1["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_19 in Exclude<keyof I_1["nonexist"]["left"]["path"][number], keyof InnerOp>]: never; })[] & { [K_20 in Exclude<keyof I_1["nonexist"]["left"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_21 in Exclude<keyof I_1["nonexist"]["left"], keyof ExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_22 in Exclude<keyof I_1["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[] & ({
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                } & { [K_23 in Exclude<keyof I_1["nonexist"]["right"]["path"][number], keyof InnerOp>]: never; })[] & { [K_24 in Exclude<keyof I_1["nonexist"]["right"]["path"], keyof {
                    hash?: HashOp;
                    prefix?: Uint8Array;
                    suffix?: Uint8Array;
                }[]>]: never; };
            } & { [K_25 in Exclude<keyof I_1["nonexist"]["right"], keyof ExistenceProof>]: never; };
        } & { [K_26 in Exclude<keyof I_1["nonexist"], keyof NonExistenceProof>]: never; };
    } & { [K_27 in Exclude<keyof I_1, keyof BatchEntry>]: never; }>(object: I_1): BatchEntry;
};
export declare const CompressedBatchProof: {
    encode(message: CompressedBatchProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): CompressedBatchProof;
    fromJSON(object: any): CompressedBatchProof;
    toJSON(message: CompressedBatchProof): unknown;
    create<I extends {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[];
        lookupInners?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[];
    } & {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[] & ({
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        } & {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K in Exclude<keyof I["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_1 in Exclude<keyof I["entries"][number]["exist"]["path"], keyof number[]>]: never; };
            } & { [K_2 in Exclude<keyof I["entries"][number]["exist"], keyof CompressedExistenceProof>]: never; };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            } & {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_3 in Exclude<keyof I["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_4 in Exclude<keyof I["entries"][number]["nonexist"]["left"]["path"], keyof number[]>]: never; };
                } & { [K_5 in Exclude<keyof I["entries"][number]["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_6 in Exclude<keyof I["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_7 in Exclude<keyof I["entries"][number]["nonexist"]["right"]["path"], keyof number[]>]: never; };
                } & { [K_8 in Exclude<keyof I["entries"][number]["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
            } & { [K_9 in Exclude<keyof I["entries"][number]["nonexist"], keyof CompressedNonExistenceProof>]: never; };
        } & { [K_10 in Exclude<keyof I["entries"][number], keyof CompressedBatchEntry>]: never; })[] & { [K_11 in Exclude<keyof I["entries"], keyof {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[]>]: never; };
        lookupInners?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[] & ({
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & { [K_12 in Exclude<keyof I["lookupInners"][number], keyof InnerOp>]: never; })[] & { [K_13 in Exclude<keyof I["lookupInners"], keyof {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[]>]: never; };
    } & { [K_14 in Exclude<keyof I, keyof CompressedBatchProof>]: never; }>(base?: I): CompressedBatchProof;
    fromPartial<I_1 extends {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[];
        lookupInners?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[];
    } & {
        entries?: {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[] & ({
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        } & {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_15 in Exclude<keyof I_1["entries"][number]["exist"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_16 in Exclude<keyof I_1["entries"][number]["exist"]["path"], keyof number[]>]: never; };
            } & { [K_17 in Exclude<keyof I_1["entries"][number]["exist"], keyof CompressedExistenceProof>]: never; };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            } & {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_18 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_19 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"]["path"], keyof number[]>]: never; };
                } & { [K_20 in Exclude<keyof I_1["entries"][number]["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                } & {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    } & { [K_21 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                    path?: number[] & number[] & { [K_22 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"]["path"], keyof number[]>]: never; };
                } & { [K_23 in Exclude<keyof I_1["entries"][number]["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
            } & { [K_24 in Exclude<keyof I_1["entries"][number]["nonexist"], keyof CompressedNonExistenceProof>]: never; };
        } & { [K_25 in Exclude<keyof I_1["entries"][number], keyof CompressedBatchEntry>]: never; })[] & { [K_26 in Exclude<keyof I_1["entries"], keyof {
            exist?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            nonexist?: {
                key?: Uint8Array;
                left?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
                right?: {
                    key?: Uint8Array;
                    value?: Uint8Array;
                    leaf?: {
                        hash?: HashOp;
                        prehashKey?: HashOp;
                        prehashValue?: HashOp;
                        length?: LengthOp;
                        prefix?: Uint8Array;
                    };
                    path?: number[];
                };
            };
        }[]>]: never; };
        lookupInners?: {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[] & ({
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        } & { [K_27 in Exclude<keyof I_1["lookupInners"][number], keyof InnerOp>]: never; })[] & { [K_28 in Exclude<keyof I_1["lookupInners"], keyof {
            hash?: HashOp;
            prefix?: Uint8Array;
            suffix?: Uint8Array;
        }[]>]: never; };
    } & { [K_29 in Exclude<keyof I_1, keyof CompressedBatchProof>]: never; }>(object: I_1): CompressedBatchProof;
};
export declare const CompressedBatchEntry: {
    encode(message: CompressedBatchEntry, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): CompressedBatchEntry;
    fromJSON(object: any): CompressedBatchEntry;
    toJSON(message: CompressedBatchEntry): unknown;
    create<I extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K in Exclude<keyof I["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_1 in Exclude<keyof I["exist"]["path"], keyof number[]>]: never; };
        } & { [K_2 in Exclude<keyof I["exist"], keyof CompressedExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_3 in Exclude<keyof I["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_4 in Exclude<keyof I["nonexist"]["left"]["path"], keyof number[]>]: never; };
            } & { [K_5 in Exclude<keyof I["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_6 in Exclude<keyof I["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_7 in Exclude<keyof I["nonexist"]["right"]["path"], keyof number[]>]: never; };
            } & { [K_8 in Exclude<keyof I["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
        } & { [K_9 in Exclude<keyof I["nonexist"], keyof CompressedNonExistenceProof>]: never; };
    } & { [K_10 in Exclude<keyof I, keyof CompressedBatchEntry>]: never; }>(base?: I): CompressedBatchEntry;
    fromPartial<I_1 extends {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
        };
    } & {
        exist?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_11 in Exclude<keyof I_1["exist"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_12 in Exclude<keyof I_1["exist"]["path"], keyof number[]>]: never; };
        } & { [K_13 in Exclude<keyof I_1["exist"], keyof CompressedExistenceProof>]: never; };
        nonexist?: {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            };
        } & {
            key?: Uint8Array;
            left?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_14 in Exclude<keyof I_1["nonexist"]["left"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_15 in Exclude<keyof I_1["nonexist"]["left"]["path"], keyof number[]>]: never; };
            } & { [K_16 in Exclude<keyof I_1["nonexist"]["left"], keyof CompressedExistenceProof>]: never; };
            right?: {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                };
                path?: number[];
            } & {
                key?: Uint8Array;
                value?: Uint8Array;
                leaf?: {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & {
                    hash?: HashOp;
                    prehashKey?: HashOp;
                    prehashValue?: HashOp;
                    length?: LengthOp;
                    prefix?: Uint8Array;
                } & { [K_17 in Exclude<keyof I_1["nonexist"]["right"]["leaf"], keyof LeafOp>]: never; };
                path?: number[] & number[] & { [K_18 in Exclude<keyof I_1["nonexist"]["right"]["path"], keyof number[]>]: never; };
            } & { [K_19 in Exclude<keyof I_1["nonexist"]["right"], keyof CompressedExistenceProof>]: never; };
        } & { [K_20 in Exclude<keyof I_1["nonexist"], keyof CompressedNonExistenceProof>]: never; };
    } & { [K_21 in Exclude<keyof I_1, keyof CompressedBatchEntry>]: never; }>(object: I_1): CompressedBatchEntry;
};
export declare const CompressedExistenceProof: {
    encode(message: CompressedExistenceProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): CompressedExistenceProof;
    fromJSON(object: any): CompressedExistenceProof;
    toJSON(message: CompressedExistenceProof): unknown;
    create<I extends {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        path?: number[];
    } & {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K in Exclude<keyof I["leaf"], keyof LeafOp>]: never; };
        path?: number[] & number[] & { [K_1 in Exclude<keyof I["path"], keyof number[]>]: never; };
    } & { [K_2 in Exclude<keyof I, keyof CompressedExistenceProof>]: never; }>(base?: I): CompressedExistenceProof;
    fromPartial<I_1 extends {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        };
        path?: number[];
    } & {
        key?: Uint8Array;
        value?: Uint8Array;
        leaf?: {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & {
            hash?: HashOp;
            prehashKey?: HashOp;
            prehashValue?: HashOp;
            length?: LengthOp;
            prefix?: Uint8Array;
        } & { [K_3 in Exclude<keyof I_1["leaf"], keyof LeafOp>]: never; };
        path?: number[] & number[] & { [K_4 in Exclude<keyof I_1["path"], keyof number[]>]: never; };
    } & { [K_5 in Exclude<keyof I_1, keyof CompressedExistenceProof>]: never; }>(object: I_1): CompressedExistenceProof;
};
export declare const CompressedNonExistenceProof: {
    encode(message: CompressedNonExistenceProof, writer?: _m0.Writer): _m0.Writer;
    decode(input: _m0.Reader | Uint8Array, length?: number): CompressedNonExistenceProof;
    fromJSON(object: any): CompressedNonExistenceProof;
    toJSON(message: CompressedNonExistenceProof): unknown;
    create<I extends {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
    } & {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K in Exclude<keyof I["left"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_1 in Exclude<keyof I["left"]["path"], keyof number[]>]: never; };
        } & { [K_2 in Exclude<keyof I["left"], keyof CompressedExistenceProof>]: never; };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_3 in Exclude<keyof I["right"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_4 in Exclude<keyof I["right"]["path"], keyof number[]>]: never; };
        } & { [K_5 in Exclude<keyof I["right"], keyof CompressedExistenceProof>]: never; };
    } & { [K_6 in Exclude<keyof I, keyof CompressedNonExistenceProof>]: never; }>(base?: I): CompressedNonExistenceProof;
    fromPartial<I_1 extends {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        };
    } & {
        key?: Uint8Array;
        left?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_7 in Exclude<keyof I_1["left"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_8 in Exclude<keyof I_1["left"]["path"], keyof number[]>]: never; };
        } & { [K_9 in Exclude<keyof I_1["left"], keyof CompressedExistenceProof>]: never; };
        right?: {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            };
            path?: number[];
        } & {
            key?: Uint8Array;
            value?: Uint8Array;
            leaf?: {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & {
                hash?: HashOp;
                prehashKey?: HashOp;
                prehashValue?: HashOp;
                length?: LengthOp;
                prefix?: Uint8Array;
            } & { [K_10 in Exclude<keyof I_1["right"]["leaf"], keyof LeafOp>]: never; };
            path?: number[] & number[] & { [K_11 in Exclude<keyof I_1["right"]["path"], keyof number[]>]: never; };
        } & { [K_12 in Exclude<keyof I_1["right"], keyof CompressedExistenceProof>]: never; };
    } & { [K_13 in Exclude<keyof I_1, keyof CompressedNonExistenceProof>]: never; }>(object: I_1): CompressedNonExistenceProof;
};
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P : P & {
    [K in keyof P]: Exact<P[K], I[K]>;
} & {
    [K in Exclude<keyof I, KeysOfUnion<P>>]: never;
};
export {};
